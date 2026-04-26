import 'dotenv/config'
import { type Address, type Hash, type Hex, createWalletClient, formatUnits, getAddress, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { roastWagerAbi } from './lib/abi.js'
import { celoMainnet, publicClient, rpcUrl } from './lib/viemClient.js'
import { handleClaimed } from './handlers/claimed.js'
import { handleRefunded } from './handlers/refunded.js'
import { handleResolved } from './handlers/resolved.js'
import { handleVoted } from './handlers/voted.js'
import { handleWagerCreated } from './handlers/wagerCreated.js'
import {
  getSyncState,
  getPostById,
  getWager,
  supabase,
  updateLastProcessedBlock,
} from './db/supabase.js'
import { currentContractScope, scopedPostLikePattern, scopeWagerId, unscopePostId } from './lib/scope.js'

const contractAddressEnv = process.env.CONTRACT_ADDRESS
const stableSymbol = process.env.STABLE_SYMBOL ?? 'USDC'
const stableDecimals = Number(process.env.STABLE_DECIMALS ?? 6)

if (!contractAddressEnv) {
  throw new Error('Missing CONTRACT_ADDRESS')
}

if (!Number.isInteger(stableDecimals) || stableDecimals < 0) {
  throw new Error('Invalid STABLE_DECIMALS')
}

const contractAddress: Address = getAddress(contractAddressEnv)

const MAX_BACKOFF_MS = 30_000
const INITIAL_BACKOFF_MS = 1_000
const LOGS_BLOCK_RANGE = 100n
const configuredSyncStartBlock = process.env.SYNC_START_BLOCK
const autoResolveEnabled = (process.env.AUTO_RESOLVE_ENABLED ?? 'true').toLowerCase() === 'true'
const autoResolveIntervalMs = parsePositiveInt(process.env.AUTO_RESOLVE_INTERVAL_MS, 15_000)
const autoResolveBatchSize = parsePositiveInt(process.env.AUTO_RESOLVE_BATCH_SIZE, 5)
const autoResolveFailureCooldownMs = parsePositiveInt(process.env.AUTO_RESOLVE_FAILURE_COOLDOWN_MS, 120_000)
const autoResolvePrivateKey = process.env.AUTO_RESOLVE_PRIVATE_KEY?.trim() ?? process.env.PRIVATE_KEY?.trim()

type AutoResolvePostRow = {
  id: string
  end_time: string | number | bigint
}

type EventName = 'WagerCreated' | 'Voted' | 'Resolved' | 'Refunded' | 'Claimed'

const EVENT_ABI = {
  WagerCreated: roastWagerAbi[0],
  Voted: roastWagerAbi[1],
  Resolved: roastWagerAbi[2],
  Refunded: roastWagerAbi[3],
  Claimed: roastWagerAbi[4],
} as const

interface NormalizedEventLog {
  eventName: EventName
  args: Record<string, unknown>
  blockNumber: bigint
  logIndex: bigint
  transactionHash?: Hash
}

type Unwatch = () => void

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  const value = rawValue?.trim()
  if (!value) return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

function isLikelyPrivateKey(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value)
}

function parseEndTimeSeconds(value: string | number | bigint): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'bigint') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return parsed
}

function getPostIdFromScopedId(scopedId: string): bigint | null {
  const unscopedId = unscopePostId(scopedId).trim()
  if (unscopedId.length === 0) {
    return null
  }

  try {
    return BigInt(unscopedId)
  } catch {
    return null
  }
}

function createAutoResolveWalletClient() {
  if (!autoResolveEnabled) {
    return null
  }

  if (!autoResolvePrivateKey) {
    console.warn('[AUTO_RESOLVE] Disabled: missing AUTO_RESOLVE_PRIVATE_KEY or PRIVATE_KEY')
    return null
  }

  if (!isLikelyPrivateKey(autoResolvePrivateKey)) {
    console.warn('[AUTO_RESOLVE] Disabled: invalid private key format')
    return null
  }

  const account = privateKeyToAccount(autoResolvePrivateKey)

  return createWalletClient({
    account,
    chain: celoMainnet,
    transport: http(rpcUrl),
  })
}

const autoResolveWalletClient = createAutoResolveWalletClient()
const autoResolveFailureUntil = new Map<string, number>()

function asBigint(value: unknown, fieldName: string): bigint {
  if (typeof value !== 'bigint') {
    throw new Error(`Invalid ${fieldName}`)
  }

  return value
}

function asAddress(value: unknown, fieldName: string): Address {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}`)
  }

  return getAddress(value)
}

function asString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}`)
  }

  return value
}

function asBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${fieldName}`)
  }

  return value
}

function buildWagerId(txHash: Hash, logIndex: bigint): string {
  return `${txHash.toLowerCase()}-${Number(logIndex)}`
}

async function wagerIdExists(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('wagers')
    .select('id')
    .eq('id', scopeWagerId(id))
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to check existing wager id ${id}: ${error.message}`)
  }

  return data !== null
}

async function shouldSkipAsDuplicate(log: NormalizedEventLog): Promise<boolean> {
  if (log.eventName === 'WagerCreated') {
    const postId = asBigint(log.args.postId, 'postId').toString()
    const existingPost = await getPostById(postId)
    return existingPost !== null
  }

  if (log.eventName === 'Voted') {
    if (!log.transactionHash) {
      return false
    }

    const wagerId = buildWagerId(log.transactionHash, log.logIndex)
    return wagerIdExists(wagerId)
  }

  if (log.eventName === 'Resolved') {
    const postId = asBigint(log.args.postId, 'postId').toString()
    const existingPost = await getPostById(postId)
    return existingPost?.status === 'settled'
  }

  if (log.eventName === 'Refunded') {
    const postId = asBigint(log.args.postId, 'postId').toString()
    const existingPost = await getPostById(postId)
    return existingPost?.status === 'refunded'
  }

  const postId = asBigint(log.args.postId, 'postId').toString()
  const voter = asAddress(log.args.voter, 'voter').toLowerCase()
  const wager = await getWager(postId, voter)

  return wager?.payout !== undefined
}

async function processEventLog(
  log: NormalizedEventLog,
  blockTimestampCache: Map<bigint, number>,
): Promise<void> {
  if (await shouldSkipAsDuplicate(log)) {
    await updateLastProcessedBlock(log.blockNumber)
    return
  }

  try {
    if (log.eventName === 'WagerCreated') {
      const postId = asBigint(log.args.postId, 'postId')
      const creator = asAddress(log.args.creator, 'creator')
      const content = asString(log.args.content, 'content')
      const imageUrl = asString(log.args.imageUrl, 'imageUrl')
      const endTime = asBigint(log.args.endTime, 'endTime')

      let blockTimestamp = blockTimestampCache.get(log.blockNumber)

      if (blockTimestamp === undefined) {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber })
        blockTimestamp = Number(block.timestamp)
        blockTimestampCache.set(log.blockNumber, blockTimestamp)
      }

      await handleWagerCreated({
        postId,
        creator,
        content,
        imageUrl,
        endTime,
        blockTimestamp,
      })

      console.log('[EVENT] WagerCreated:', postId.toString())
    } else if (log.eventName === 'Voted') {
      const postId = asBigint(log.args.postId, 'postId')
      const voter = asAddress(log.args.voter, 'voter')
      const isBull = asBoolean(log.args.isBull, 'isBull')
      const amount = asBigint(log.args.amount, 'amount')

      let blockTimestamp = blockTimestampCache.get(log.blockNumber)

      if (blockTimestamp === undefined) {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber })
        blockTimestamp = Number(block.timestamp)
        blockTimestampCache.set(log.blockNumber, blockTimestamp)
      }

      await handleVoted({
        args: {
          postId,
          voter,
          isBull,
          amount,
        },
        blockNumber: log.blockNumber,
        blockTimestamp: blockTimestamp !== undefined ? BigInt(blockTimestamp) : undefined,
      })

      console.log(
        `[EVENT] Voted: ${postId.toString()} | ${isBull ? 'bull' : 'bear'} | ${formatUnits(
          amount,
          stableDecimals,
        )} ${stableSymbol}`,
      )
    } else if (log.eventName === 'Resolved') {
      const postId = asBigint(log.args.postId, 'postId')
      const winningSide = asBoolean(log.args.winningSide, 'winningSide')

      await handleResolved({ postId, winningSide })

      console.log('[EVENT] Resolved:', postId.toString())
    } else if (log.eventName === 'Refunded') {
      const postId = asBigint(log.args.postId, 'postId')

      await handleRefunded({ postId })

      console.log('[EVENT] Refunded:', postId.toString())
    } else {
      const postId = asBigint(log.args.postId, 'postId')
      const voter = asAddress(log.args.voter, 'voter')
      const amount = asBigint(log.args.amount, 'amount')

      await handleClaimed({ postId, voter, amount })

      console.log('[EVENT] Claimed:', postId.toString())
    }

    await updateLastProcessedBlock(log.blockNumber)
  } catch (error) {
    console.error('[ERROR] handler:', error)
    throw error
  }
}

function normalizeLogs(
  eventName: EventName,
  logs: ReadonlyArray<{
    args?: Record<string, unknown>
    blockNumber: bigint | null
    logIndex: number | null
    transactionHash?: Hash
  }>,
): NormalizedEventLog[] {
  const normalized: NormalizedEventLog[] = []

  for (const log of logs) {
    if (log.blockNumber === null || log.logIndex === null || !log.args) {
      continue
    }

    normalized.push({
      eventName,
      args: log.args,
      blockNumber: log.blockNumber,
      logIndex: BigInt(log.logIndex),
      transactionHash: log.transactionHash,
    })
  }

  return normalized
}

async function getExpiredActivePosts(limit: number): Promise<Array<{ id: string; endTime: number }>> {
  const nowSeconds = Math.floor(Date.now() / 1000)

  const { data, error } = await supabase
    .from('posts')
    .select('id, end_time')
    .eq('status', 'active')
    .like('id', scopedPostLikePattern)
    .lte('end_time', nowSeconds)
    .order('end_time', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch expired posts: ${error.message}`)
  }

  const rows = (data ?? []) as AutoResolvePostRow[]
  const normalized: Array<{ id: string; endTime: number }> = []

  for (const row of rows) {
    const endTime = parseEndTimeSeconds(row.end_time)

    if (typeof row.id !== 'string' || endTime === null) {
      continue
    }

    normalized.push({ id: row.id, endTime })
  }

  return normalized
}

async function autoResolveExpiredPosts(): Promise<void> {
  if (!autoResolveWalletClient) {
    return
  }

  const nowMs = Date.now()
  const expiredPosts = await getExpiredActivePosts(autoResolveBatchSize)

  for (const post of expiredPosts) {
    const blockedUntil = autoResolveFailureUntil.get(post.id) ?? 0
    if (blockedUntil > nowMs) {
      continue
    }

    const postId = getPostIdFromScopedId(post.id)
    if (postId === null) {
      autoResolveFailureUntil.set(post.id, nowMs + autoResolveFailureCooldownMs)
      continue
    }

    try {
      const hash = await autoResolveWalletClient.writeContract({
        address: contractAddress,
        abi: roastWagerAbi,
        functionName: 'resolve',
        args: [postId],
      })

      console.log(`[AUTO_RESOLVE] Submitted resolve for post ${postId.toString()} (${hash})`)

      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status !== 'success') {
        throw new Error('Resolve transaction reverted')
      }

      autoResolveFailureUntil.delete(post.id)
      console.log(`[AUTO_RESOLVE] Confirmed resolve for post ${postId.toString()}`)
    } catch (error) {
      autoResolveFailureUntil.set(post.id, nowMs + autoResolveFailureCooldownMs)
      console.error(`[AUTO_RESOLVE] Failed to resolve post ${postId.toString()}:`, error)
    }
  }
}

export async function syncMissedEvents(fromBlock: bigint, toBlock: bigint): Promise<void> {
  if (fromBlock > toBlock) {
    return
  }

  console.log(`[LISTENER] Starting sync from block ${fromBlock.toString()} to ${toBlock.toString()}...`)
  let cursor = fromBlock
  let processedLogs = 0

  while (cursor <= toBlock) {
    const chunkTo = cursor + (LOGS_BLOCK_RANGE - 1n) > toBlock ? toBlock : cursor + (LOGS_BLOCK_RANGE - 1n)

    const [wagerCreatedLogs, votedLogs, resolvedLogs, refundedLogs, claimedLogs] = await Promise.all([
      publicClient.getLogs({
        address: contractAddress,
        event: EVENT_ABI.WagerCreated,
        fromBlock: cursor,
        toBlock: chunkTo,
      }),
      publicClient.getLogs({
        address: contractAddress,
        event: EVENT_ABI.Voted,
        fromBlock: cursor,
        toBlock: chunkTo,
      }),
      publicClient.getLogs({
        address: contractAddress,
        event: EVENT_ABI.Resolved,
        fromBlock: cursor,
        toBlock: chunkTo,
      }),
      publicClient.getLogs({
        address: contractAddress,
        event: EVENT_ABI.Refunded,
        fromBlock: cursor,
        toBlock: chunkTo,
      }),
      publicClient.getLogs({
        address: contractAddress,
        event: EVENT_ABI.Claimed,
        fromBlock: cursor,
        toBlock: chunkTo,
      }),
    ])

    const allLogs: NormalizedEventLog[] = [
      ...normalizeLogs('WagerCreated', wagerCreatedLogs),
      ...normalizeLogs('Voted', votedLogs),
      ...normalizeLogs('Resolved', resolvedLogs),
      ...normalizeLogs('Refunded', refundedLogs),
      ...normalizeLogs('Claimed', claimedLogs),
    ].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber < b.blockNumber ? -1 : 1
      }

      if (a.logIndex !== b.logIndex) {
        return a.logIndex < b.logIndex ? -1 : 1
      }

      return a.eventName.localeCompare(b.eventName)
    })

    const blockTimestampCache = new Map<bigint, number>()

    for (const log of allLogs) {
      await processEventLog(log, blockTimestampCache)
    }

    processedLogs += allLogs.length
    await updateLastProcessedBlock(chunkTo)
    cursor = chunkTo + 1n
  }

  console.log(`[SYNC] Processed ${processedLogs} missed events`)
}

export function startEventListener(): () => void {
  let stopped = false
  let reconnectTimer: NodeJS.Timeout | null = null
  let autoResolveTimer: NodeJS.Timeout | null = null
  let autoResolveRunning = false
  let reconnectAttempt = 0
  let reconnectScheduled = false
  let unwatchers: Unwatch[] = []

  const cleanupWatchers = (): void => {
    for (const unwatch of unwatchers) {
      try {
        unwatch()
      } catch (error) {
        console.error('[ERROR] handler:', error)
      }
    }

    unwatchers = []
  }

  const scheduleReconnect = (): void => {
    if (stopped || reconnectScheduled) {
      return
    }

    reconnectScheduled = true
    cleanupWatchers()

    const delay = Math.min(INITIAL_BACKOFF_MS * 2 ** reconnectAttempt, MAX_BACKOFF_MS)
    reconnectAttempt += 1
    console.warn(`[LISTENER] Reconnecting in ${delay}ms (attempt ${reconnectAttempt})`)

    reconnectTimer = setTimeout(() => {
      reconnectScheduled = false
      void startWatchers()
    }, delay)
  }

  const scheduleAutoResolve = (delayMs = autoResolveIntervalMs): void => {
    if (stopped || !autoResolveWalletClient || !autoResolveEnabled) {
      return
    }

    if (autoResolveTimer) {
      clearTimeout(autoResolveTimer)
      autoResolveTimer = null
    }

    autoResolveTimer = setTimeout(() => {
      void runAutoResolve()
    }, delayMs)
  }

  const runAutoResolve = async (): Promise<void> => {
    if (stopped || !autoResolveWalletClient || !autoResolveEnabled) {
      return
    }

    if (autoResolveRunning) {
      scheduleAutoResolve(Math.min(1_000, autoResolveIntervalMs))
      return
    }

    autoResolveRunning = true

    try {
      await autoResolveExpiredPosts()
    } catch (error) {
      console.error('[AUTO_RESOLVE] Tick failed:', error)
    } finally {
      autoResolveRunning = false
      scheduleAutoResolve()
    }
  }

  const registerWatcher = (eventName: EventName): void => {
    try {
      const unwatch = publicClient.watchContractEvent({
        address: contractAddress,
        abi: roastWagerAbi,
        eventName,
        onLogs: async (logs) => {
          const normalizedLogs = normalizeLogs(eventName, logs)

          const blockTimestampCache = new Map<bigint, number>()

          for (const log of normalizedLogs) {
            try {
              await processEventLog(log, blockTimestampCache)
            } catch (error) {
              console.error('[ERROR] handler:', error)
            }
          }
        },
        onError: (error) => {
          console.error('[ERROR] handler:', error)
          scheduleReconnect()
        },
      })

      unwatchers.push(unwatch)
    } catch (error) {
      console.error('[ERROR] handler:', error)
      scheduleReconnect()
    }
  }

  const startWatchers = async (): Promise<void> => {
    if (stopped) {
      return
    }

    try {
      const syncState = await getSyncState()
      let lastProcessedBlock = syncState.lastProcessedBlock
      const trackedContract = syncState.contractAddress?.trim().toLowerCase() ?? null

      if (trackedContract !== currentContractScope) {
        console.warn(
          `[LISTENER] Detected contract change in sync_state (${trackedContract ?? 'null'} -> ${currentContractScope}), resetting cursor`,
        )
        await updateLastProcessedBlock(0n)
        lastProcessedBlock = 0n
      }

      const currentBlock = await publicClient.getBlockNumber()
      let syncFromBlock: bigint | null = null

      if (lastProcessedBlock === 0n) {
        if (configuredSyncStartBlock && configuredSyncStartBlock.trim().length > 0) {
          const parsedStartBlock = BigInt(configuredSyncStartBlock)
          syncFromBlock = parsedStartBlock > 0n ? parsedStartBlock : 1n
        } else {
          // Avoid scanning millions of blocks on first boot when RPC range is very limited.
          syncFromBlock = currentBlock
          await updateLastProcessedBlock(currentBlock)
          console.warn(
            `[LISTENER] last_processed_block is 0 and SYNC_START_BLOCK is not set; starting from current block ${currentBlock.toString()}`,
          )
        }
      } else if (lastProcessedBlock < currentBlock) {
        syncFromBlock = lastProcessedBlock + 1n
      }

      if (syncFromBlock !== null && syncFromBlock <= currentBlock) {
        await syncMissedEvents(syncFromBlock, currentBlock)
      }

      cleanupWatchers()

      registerWatcher('WagerCreated')
      registerWatcher('Voted')
      registerWatcher('Resolved')
      registerWatcher('Refunded')
      registerWatcher('Claimed')

      reconnectAttempt = 0

      console.log(`[LISTENER] Watching for new events on ${contractAddress}...`)
    } catch (error) {
      console.error('[ERROR] handler:', error)
      scheduleReconnect()
    }
  }

  void startWatchers()

  if (autoResolveEnabled && autoResolveWalletClient) {
    console.log(
      `[AUTO_RESOLVE] Enabled (interval=${autoResolveIntervalMs}ms, batch=${autoResolveBatchSize})`,
    )
    scheduleAutoResolve(2_000)
  }

  return () => {
    stopped = true

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    if (autoResolveTimer) {
      clearTimeout(autoResolveTimer)
      autoResolveTimer = null
    }

    cleanupWatchers()
  }
}

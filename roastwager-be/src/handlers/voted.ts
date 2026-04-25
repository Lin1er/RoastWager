import { publicClient } from '../lib/viemClient.js'
import {
  createWager,
  getPostById,
  getUser,
  getWager,
  updatePost,
  upsertUser,
} from '../db/supabase.js'
import type { Side, User, Wager } from '../types/index.js'

interface VotedArgs {
  postId: unknown
  voter: unknown
  isBull: unknown
  amount: unknown
}

interface VotedLog {
  args: VotedArgs
  blockNumber?: bigint | null
  blockTimestamp?: bigint | null
}

interface LegacyVotedInput {
  postId: bigint
  voter: `0x${string}`
  isBull: boolean
  amount: bigint
  blockTimestamp?: number
}

function asString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}`)
  }

  return value
}

function asBigint(value: unknown, fieldName: string): bigint {
  if (typeof value !== 'bigint') {
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

function normalizePostId(value: unknown): string {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string') return value.startsWith('0x') ? value.toLowerCase() : value
  throw new Error('Invalid postId')
}

function normalizeInput(input: VotedLog | LegacyVotedInput): {
  postId: string
  voter: string
  isBull: boolean
  amount: string
  blockNumber?: bigint
  blockTimestamp?: bigint
} {
  if ('args' in input) {
    return {
      postId: normalizePostId(input.args.postId),
      voter: asString(input.args.voter, 'voter').toLowerCase(),
      isBull: asBoolean(input.args.isBull, 'isBull'),
      amount: asBigint(input.args.amount, 'amount').toString(),
      blockNumber: input.blockNumber ?? undefined,
      blockTimestamp: input.blockTimestamp ?? undefined,
    }
  }

  return {
    postId: input.postId.toString(),
    voter: input.voter.toLowerCase(),
    isBull: input.isBull,
    amount: input.amount.toString(),
    blockTimestamp: input.blockTimestamp !== undefined ? BigInt(input.blockTimestamp) : undefined,
  }
}

function getLevel(xp: number): number {
  if (xp >= 10000) return 5
  if (xp >= 2000) return 4
  if (xp >= 500) return 3
  if (xp >= 100) return 2
  return 1
}

async function resolveTimestamp(blockNumber?: bigint, blockTimestamp?: bigint): Promise<string> {
  if (blockTimestamp !== undefined) {
    return blockTimestamp.toString()
  }

  if (blockNumber !== undefined) {
    const block = await publicClient.getBlock({ blockNumber })
    return block.timestamp.toString()
  }

  return Math.floor(Date.now() / 1000).toString()
}

export async function handleVoted(input: VotedLog | LegacyVotedInput): Promise<void> {
  try {
    const normalized = normalizeInput(input)

    const existingWager = await getWager(normalized.postId, normalized.voter)
    if (existingWager) {
      return
    }

    const post = await getPostById(normalized.postId)
    if (!post) {
      throw new Error(`Post not found: ${normalized.postId}`)
    }

    const timestamp = await resolveTimestamp(normalized.blockNumber, normalized.blockTimestamp)
    const side: Side = normalized.isBull ? 'bull' : 'bear'

    const wager: Wager = {
      id: `${normalized.postId}-${normalized.voter}`,
      postId: normalized.postId,
      userAddress: normalized.voter,
      side,
      amount: normalized.amount,
      result: 'pending',
      timestamp,
    }

    await createWager(wager)

    const amountBigInt = BigInt(normalized.amount)

    if (normalized.isBull) {
      await updatePost(normalized.postId, {
        bullPool: (BigInt(post.bullPool) + amountBigInt).toString(),
        bullCount: post.bullCount + 1,
      })
    } else {
      await updatePost(normalized.postId, {
        bearPool: (BigInt(post.bearPool) + amountBigInt).toString(),
        bearCount: post.bearCount + 1,
      })
    }

    const user = await getUser(normalized.voter)

    if (user) {
      const nextXP = user.experience + 10
      const nextUser: User = {
        ...user,
        level: getLevel(nextXP),
        experience: nextXP,
        lastWagerAt: timestamp,
      }
      await upsertUser(nextUser)
    } else {
      await upsertUser({
        id: normalized.voter,
        level: 1,
        experience: 10,
        lastWagerAt: timestamp,
      })
    }

    console.log('[EVENT] Voted:', normalized.postId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`[handleVoted] ${message}`)
  }
}

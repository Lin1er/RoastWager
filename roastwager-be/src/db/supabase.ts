import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import {
  currentContractScope,
  scopePostId,
  scopedPostLikePattern,
  scopeWagerId,
  scopedWagerLikePattern,
  unscopePostId,
  unscopeWagerId,
} from '../lib/scope.js'
import type { Post, Side, Status, User, Wager } from '../types/index.js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL')
}

if (!supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export interface SyncState {
  contractAddress: string | null
  lastProcessedBlock: bigint
}

interface GetPostsParams {
  status?: Status
  limit?: number
  offset?: number
  cursor?: string | bigint
}

type Row = Record<string, unknown>

function fail(context: string, message: string): never {
  throw new Error(`[supabase:${context}] ${message}`)
}

function toStringField(row: Row, field: string, context: string): string {
  const value = row[field]
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  fail(context, `Invalid ${field}`)
}

function toNullableStringField(row: Row, field: string, context: string): string | null {
  const value = row[field]
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  fail(context, `Invalid ${field}`)
}

function toNumberField(row: Row, field: string, context: string): number {
  const value = row[field]
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  fail(context, `Invalid ${field}`)
}

function toStatusField(row: Row, field: string, context: string): Status {
  const value = row[field]
  if (value === 'active' || value === 'settled' || value === 'refunded') {
    return value
  }
  fail(context, `Invalid ${field}`)
}

function toSideFromDb(value: unknown, context: string): Side | undefined {
  if (value === null || value === undefined) return undefined
  if (value === 'bull' || value === 1 || value === '1') return 'bull'
  if (value === 'bear' || value === 2 || value === '2') return 'bear'
  fail(context, 'Invalid winning_side')
}

function sideToDbCode(side: Side | undefined): 1 | 2 | null | undefined {
  if (side === undefined) return undefined
  if (side === 'bull') return 1
  if (side === 'bear') return 2
  return null
}

function mapPostRow(row: Row, context: string): Post {
  return {
    id: unscopePostId(toStringField(row, 'id', context)),
    creator: toStringField(row, 'creator', context),
    content: toStringField(row, 'content', context),
    imageUrl: toNullableStringField(row, 'image_url', context),
    endTime: toStringField(row, 'end_time', context),
    status: toStatusField(row, 'status', context),
    winningSide: toSideFromDb(row.winning_side, context),
    bullPool: toStringField(row, 'bull_pool', context),
    bearPool: toStringField(row, 'bear_pool', context),
    bullCount: toNumberField(row, 'bull_count', context),
    bearCount: toNumberField(row, 'bear_count', context),
    createdAt: toStringField(row, 'created_at', context),
  }
}

function mapWagerRow(row: Row, context: string): Wager {
  const side = row.side
  if (side !== 'bull' && side !== 'bear') {
    fail(context, 'Invalid side')
  }

  const result = row.result
  if (result !== 'pending' && result !== 'win' && result !== 'lose' && result !== 'refund') {
    fail(context, 'Invalid result')
  }

  return {
    id: unscopeWagerId(toStringField(row, 'id', context)),
    postId: unscopePostId(toStringField(row, 'post_id', context)),
    userAddress: toStringField(row, 'user_address', context),
    side,
    amount: toStringField(row, 'amount', context),
    result,
    payout: toNullableStringField(row, 'payout', context) ?? undefined,
    timestamp: toStringField(row, 'timestamp', context),
  }
}

function mapUserRow(row: Row, context: string): User {
  return {
    id: toStringField(row, 'id', context),
    level: toNumberField(row, 'level', context),
    experience: toNumberField(row, 'experience', context),
    lastWagerAt: toStringField(row, 'last_wager_at', context),
  }
}

function throwSupabaseError(context: string, error: { message: string; details?: string | null }): never {
  const details = error.details ? ` | details: ${error.details}` : ''
  throw new Error(`[supabase:${context}] ${error.message}${details}`)
}

export async function getPosts(params: GetPostsParams = {}): Promise<Post[]> {
  const { status, limit = 20, offset, cursor } = params

  let query = supabase
    .from('posts')
    .select('*')
    .like('id', scopedPostLikePattern)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  if (cursor !== undefined) {
    query = query.lt('created_at', typeof cursor === 'bigint' ? cursor.toString() : cursor)
  }

  if (offset !== undefined) {
    query = query.range(offset, offset + limit - 1)
  } else {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    throwSupabaseError('getPosts', error)
  }

  const rows = (data ?? []) as Row[]
  return rows.map((row) => mapPostRow(row, 'getPosts'))
}

export async function getPostById(id: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', scopePostId(id))
    .maybeSingle()

  if (error) {
    throwSupabaseError('getPostById', error)
  }

  if (!data) return null
  return mapPostRow(data as Row, 'getPostById')
}

export async function getPostsByCreator(address: string): Promise<Post[]> {
  const normalizedAddress = address.toLowerCase()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('creator', normalizedAddress)
    .like('id', scopedPostLikePattern)
    .order('created_at', { ascending: false })

  if (error) {
    throwSupabaseError('getPostsByCreator', error)
  }

  const rows = (data ?? []) as Row[]
  return rows.map((row) => mapPostRow(row, 'getPostsByCreator'))
}

export async function createPost(data: Omit<Post, 'winningSide'>): Promise<void> {
  const payload = {
    id: scopePostId(data.id),
    creator: data.creator.toLowerCase(),
    content: data.content,
    image_url: data.imageUrl,
    end_time: data.endTime,
    status: data.status,
    winning_side: null,
    bull_pool: data.bullPool,
    bear_pool: data.bearPool,
    bull_count: data.bullCount,
    bear_count: data.bearCount,
    created_at: data.createdAt,
  }

  const { error } = await supabase.from('posts').insert(payload)

  if (error) {
    throwSupabaseError('createPost', error)
  }
}

export async function updatePost(id: string, data: Partial<Post>): Promise<void> {
  const payload: Record<string, unknown> = {}

  if (data.creator !== undefined) payload.creator = data.creator.toLowerCase()
  if (data.content !== undefined) payload.content = data.content
  if (data.imageUrl !== undefined) payload.image_url = data.imageUrl
  if (data.endTime !== undefined) payload.end_time = data.endTime
  if (data.status !== undefined) payload.status = data.status
  if (data.winningSide !== undefined) payload.winning_side = sideToDbCode(data.winningSide)
  if (data.bullPool !== undefined) payload.bull_pool = data.bullPool
  if (data.bearPool !== undefined) payload.bear_pool = data.bearPool
  if (data.bullCount !== undefined) payload.bull_count = data.bullCount
  if (data.bearCount !== undefined) payload.bear_count = data.bearCount
  if (data.createdAt !== undefined) payload.created_at = data.createdAt

  if (Object.keys(payload).length === 0) {
    return
  }

  const { error } = await supabase
    .from('posts')
    .update(payload)
    .eq('id', scopePostId(id))

  if (error) {
    throwSupabaseError('updatePost', error)
  }
}

export async function createWager(data: Wager): Promise<void> {
  const payload = {
    id: scopeWagerId(data.id),
    post_id: scopePostId(data.postId),
    user_address: data.userAddress.toLowerCase(),
    side: data.side,
    amount: data.amount,
    result: data.result,
    payout: data.payout ?? null,
    timestamp: data.timestamp,
  }

  const { error } = await supabase.from('wagers').insert(payload)

  if (error) {
    throwSupabaseError('createWager', error)
  }
}

export async function updateWager(id: string, data: Partial<Wager>): Promise<void> {
  const payload: Record<string, unknown> = {}

  if (data.postId !== undefined) payload.post_id = scopePostId(data.postId)
  if (data.userAddress !== undefined) payload.user_address = data.userAddress.toLowerCase()
  if (data.side !== undefined) payload.side = data.side
  if (data.amount !== undefined) payload.amount = data.amount
  if (data.result !== undefined) payload.result = data.result
  if (data.payout !== undefined) payload.payout = data.payout
  if (data.timestamp !== undefined) payload.timestamp = data.timestamp

  if (Object.keys(payload).length === 0) {
    return
  }

  const { error } = await supabase
    .from('wagers')
    .update(payload)
    .eq('id', scopeWagerId(id))

  if (error) {
    throwSupabaseError('updateWager', error)
  }
}

export async function getWagersByPost(postId: string): Promise<Wager[]> {
  const { data, error } = await supabase
    .from('wagers')
    .select('*')
    .eq('post_id', scopePostId(postId))
    .order('timestamp', { ascending: false })

  if (error) {
    throwSupabaseError('getWagersByPost', error)
  }

  const rows = (data ?? []) as Row[]
  return rows.map((row) => mapWagerRow(row, 'getWagersByPost'))
}

export async function getWagersByUser(address: string, limit = 50): Promise<Wager[]> {
  const normalizedAddress = address.toLowerCase()
  const { data, error } = await supabase
    .from('wagers')
    .select('*')
    .eq('user_address', normalizedAddress)
    .like('post_id', scopedPostLikePattern)
    .like('id', scopedWagerLikePattern)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    throwSupabaseError('getWagersByUser', error)
  }

  const rows = (data ?? []) as Row[]
  return rows.map((row) => mapWagerRow(row, 'getWagersByUser'))
}

export async function getWager(postId: string, userAddress: string): Promise<Wager | null> {
  const normalizedAddress = userAddress.toLowerCase()
  const { data, error } = await supabase
    .from('wagers')
    .select('*')
    .eq('post_id', scopePostId(postId))
    .eq('user_address', normalizedAddress)
    .maybeSingle()

  if (error) {
    throwSupabaseError('getWager', error)
  }

  if (!data) return null
  return mapWagerRow(data as Row, 'getWager')
}

export async function upsertUser(data: User): Promise<void> {
  const payload = {
    id: data.id.toLowerCase(),
    level: data.level,
    experience: data.experience,
    last_wager_at: data.lastWagerAt ?? '0',
  }

  const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' })

  if (error) {
    throwSupabaseError('upsertUser', error)
  }
}

export async function getUser(address: string): Promise<User | null> {
  const normalizedAddress = address.toLowerCase()
  const { data, error } = await supabase.from('users').select('*').eq('id', normalizedAddress).maybeSingle()

  if (error) {
    throwSupabaseError('getUser', error)
  }

  if (!data) return null
  return mapUserRow(data as Row, 'getUser')
}

export async function updateUserXP(address: string, xpDelta: number): Promise<void> {
  const normalizedAddress = address.toLowerCase()
  const existingUser = await getUser(normalizedAddress)

  if (!existingUser) {
    await upsertUser({
      id: normalizedAddress,
      level: 1,
      experience: Math.max(0, xpDelta),
      lastWagerAt: '0',
    })
    return
  }

  const nextXP = Math.max(0, existingUser.experience + xpDelta)

  const { error } = await supabase
    .from('users')
    .update({ experience: nextXP })
    .eq('id', normalizedAddress)

  if (error) {
    throwSupabaseError('updateUserXP', error)
  }
}

export async function getSyncState(): Promise<SyncState> {
  const { data, error } = await supabase
    .from('sync_state')
    .select('last_processed_block, contract_address')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    throwSupabaseError('getSyncState', error)
  }

  if (!data) {
    const { error: initError } = await supabase
      .from('sync_state')
      .insert({
        id: 1,
        contract_address: currentContractScope,
        last_processed_block: '0',
      })

    if (initError) {
      throwSupabaseError('getSyncState:init', initError)
    }

    return {
      contractAddress: currentContractScope,
      lastProcessedBlock: 0n,
    }
  }

  const row = data as Row
  return {
    contractAddress: toNullableStringField(row, 'contract_address', 'getSyncState'),
    lastProcessedBlock: BigInt(toStringField(row, 'last_processed_block', 'getSyncState')),
  }
}

export async function getLastProcessedBlock(): Promise<bigint> {
  const state = await getSyncState()
  return state.lastProcessedBlock
}

export async function updateLastProcessedBlock(block: bigint): Promise<void> {
  const { error } = await supabase.from('sync_state').upsert(
    {
      id: 1,
      contract_address: currentContractScope,
      last_processed_block: block.toString(),
    },
    { onConflict: 'id' },
  )

  if (error) {
    throwSupabaseError('updateLastProcessedBlock', error)
  }
}

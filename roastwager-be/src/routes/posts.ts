import { Hono } from 'hono'
import { getPostById, supabase } from '../db/supabase.js'
import { scopePostId, scopedPostLikePattern, unscopePostId, unscopeWagerId } from '../lib/scope.js'
import type { Post, Result, Side, Wager } from '../types/index.js'

interface PostRow {
  id: string
  creator: string
  content: string
  image_url: string | null
  end_time: string | number
  status: 'active' | 'settled' | 'refunded'
  winning_side: 1 | 2 | null | '1' | '2'
  bull_pool: string | number
  bear_pool: string | number
  bull_count: number
  bear_count: number
  created_at: string | number
}

interface WagerRow {
  id: string
  post_id: string
  user_address: string
  side: Side
  amount: string | number
  result: Result
  payout: string | number | null
  timestamp: string | number
}

type BlindPost = Omit<Post, 'bullPool' | 'bearPool' | 'bullCount' | 'bearCount'>

export const postsRouter = new Hono()

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Invalid integer query param')
  }

  return parsed
}

function mapWinningSide(value: PostRow['winning_side']): Side | undefined {
  if (value === 1 || value === '1') return 'bull'
  if (value === 2 || value === '2') return 'bear'
  return undefined
}

function mapPostRow(row: PostRow): Post {
  return {
    id: unscopePostId(row.id),
    creator: row.creator,
    content: row.content,
    imageUrl: row.image_url,
    endTime: String(row.end_time),
    status: row.status,
    winningSide: mapWinningSide(row.winning_side),
    bullPool: String(row.bull_pool),
    bearPool: String(row.bear_pool),
    bullCount: Number(row.bull_count),
    bearCount: Number(row.bear_count),
    createdAt: String(row.created_at),
  }
}

function mapWagerRow(row: WagerRow): Wager {
  return {
    id: unscopeWagerId(row.id),
    postId: unscopePostId(row.post_id),
    userAddress: row.user_address,
    side: row.side,
    amount: String(row.amount),
    result: row.result,
    payout: row.payout === null ? undefined : String(row.payout),
    timestamp: String(row.timestamp),
  }
}

postsRouter.get('/', async (c) => {
  try {
    const status = c.req.query('status')
    const limit = parseNonNegativeInt(c.req.query('limit'), 20)
    const offset = parseNonNegativeInt(c.req.query('offset'), 0)
    const includeTotal = c.req.query('includeTotal') === 'true'

    if (status && status !== 'active' && status !== 'settled' && status !== 'refunded') {
      return c.json({ error: 'Invalid status', code: 'BAD_REQUEST' }, 400)
    }

    let dataQuery = supabase
      .from('posts')
      .select('*')
      .like('id', scopedPostLikePattern)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit)

    if (status) {
      dataQuery = dataQuery.eq('status', status)
    }

    const countQuery = includeTotal
      ? supabase.from('posts').select('id', { count: 'exact', head: true }).like('id', scopedPostLikePattern)
      : null

    const [{ data, error: dataError }, countResult] = await Promise.all([
      dataQuery,
      includeTotal
        ? status
          ? countQuery!.eq('status', status)
          : countQuery!
        : Promise.resolve({ count: null, error: null } as { count: number | null; error: null }),
    ])

    if (dataError) {
      return c.json({ error: dataError.message, code: 'DB_ERROR' }, 500)
    }

    if (countResult.error) {
      return c.json({ error: countResult.error.message, code: 'DB_ERROR' }, 500)
    }

    const rows = (data ?? []) as PostRow[]
    const hasMore = rows.length > limit
    const pagedRows = hasMore ? rows.slice(0, limit) : rows
    const posts = pagedRows.map(mapPostRow)
    const total = countResult.count

    if (status === 'active') {
      const blindPosts: BlindPost[] = posts.map(({ bullPool, bearPool, bullCount, bearCount, ...rest }) => rest)
      c.header('Cache-Control', 'public, max-age=10, s-maxage=10, stale-while-revalidate=30')
      return c.json({ data: blindPosts, total, hasMore, meta: { total, hasMore, limit, offset } })
    }

    c.header('Cache-Control', 'public, max-age=10, s-maxage=10, stale-while-revalidate=30')
    return c.json({ data: posts, total, hasMore, meta: { total, hasMore, limit, offset } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message, code: 'INTERNAL_ERROR' }, 500)
  }
})

postsRouter.get('/:id', async (c) => {
  try {
    const post = await getPostById(c.req.param('id'))

    if (!post) {
      return c.json({ error: 'Post not found', code: 'NOT_FOUND' }, 404)
    }

    return c.json({ data: post })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message, code: 'INTERNAL_ERROR' }, 500)
  }
})

postsRouter.get('/:id/wagers', async (c) => {
  try {
    const postId = c.req.param('id')
    const limit = parseNonNegativeInt(c.req.query('limit'), 50)

    const { data, error } = await supabase
      .from('wagers')
      .select('*')
      .eq('post_id', scopePostId(postId))
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      return c.json({ error: error.message, code: 'DB_ERROR' }, 500)
    }

    const wagers = ((data ?? []) as WagerRow[]).map(mapWagerRow)
    return c.json({ data: wagers, meta: { limit } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message, code: 'INTERNAL_ERROR' }, 500)
  }
})

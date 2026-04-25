import { Hono } from 'hono'
import { getUser, supabase } from '../db/supabase.js'
import { scopedPostLikePattern, unscopePostId, unscopeWagerId } from '../lib/scope.js'
import type { Result, Side, User, Wager } from '../types/index.js'

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

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Invalid integer query param')
  }

  return parsed
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

export const usersRouter = new Hono()

usersRouter.get('/:address', async (c) => {
  try {
    const address = c.req.param('address').toLowerCase()
    const user = await getUser(address)

    if (!user) {
      const defaultUser: User = {
        id: address,
        level: 1,
        experience: 0,
        lastWagerAt: '0',
      }

      return c.json({ data: defaultUser })
    }

    return c.json({ data: user })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message, code: 'INTERNAL_ERROR' }, 500)
  }
})

usersRouter.get('/:address/wagers', async (c) => {
  try {
    const address = c.req.param('address').toLowerCase()
    const limit = parseNonNegativeInt(c.req.query('limit'), 20)
    const offset = parseNonNegativeInt(c.req.query('offset'), 0)
    const result = c.req.query('result')

    if (result && result !== 'pending' && result !== 'win' && result !== 'lose' && result !== 'refund') {
      return c.json({ error: 'Invalid result', code: 'BAD_REQUEST' }, 400)
    }

    let query = supabase
      .from('wagers')
      .select('*')
      .eq('user_address', address)
      .like('post_id', scopedPostLikePattern)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    if (result) {
      query = query.eq('result', result)
    }

    const { data, error } = await query

    if (error) {
      return c.json({ error: error.message, code: 'DB_ERROR' }, 500)
    }

    const wagers = ((data ?? []) as WagerRow[]).map(mapWagerRow)
    return c.json({ data: wagers, meta: { limit, offset, result: result ?? null } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message, code: 'INTERNAL_ERROR' }, 500)
  }
})

usersRouter.get('/:address/unclaimed', async (c) => {
  try {
    const address = c.req.param('address').toLowerCase()

    const { data, error } = await supabase
      .from('wagers')
      .select('*')
      .eq('user_address', address)
      .like('post_id', scopedPostLikePattern)
      .in('result', ['win', 'refund'])
      .is('payout', null)
      .order('timestamp', { ascending: false })

    if (error) {
      return c.json({ error: error.message, code: 'DB_ERROR' }, 500)
    }

    const wagers = ((data ?? []) as WagerRow[]).map(mapWagerRow)

    return c.json({
      data: {
        wagers,
        count: wagers.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message, code: 'INTERNAL_ERROR' }, 500)
  }
})

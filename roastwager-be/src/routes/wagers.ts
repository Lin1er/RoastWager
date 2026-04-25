import { Hono } from 'hono'
import { getWager } from '../db/supabase.js'

export const wagersRouter = new Hono()

wagersRouter.get('/:postId/:address', async (c) => {
  try {
    const postId = c.req.param('postId')
    const address = c.req.param('address').toLowerCase()

    const wager = await getWager(postId, address)

    return c.json({ data: wager })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message, code: 'INTERNAL_ERROR' }, 500)
  }
})

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { getLastProcessedBlock } from './db/supabase.js'
import { startEventListener } from './listener.js'
import { postsRouter } from './routes/posts.js'
import { uploadsRouter } from './routes/uploads.js'
import { usersRouter } from './routes/users.js'
import { wagersRouter } from './routes/wagers.js'

const app = new Hono()

const frontendUrl = process.env.FRONTEND_URL ?? '*'
const rateLimitWindowMs = 60_000
const rateLimitMax = 100

const requestStore = new Map<string, { count: number; resetAt: number }>()

function getClientIp(forwardedFor: string | undefined, realIp: string | undefined): string {
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }

  if (realIp && realIp.trim().length > 0) {
    return realIp.trim()
  }

  return 'unknown'
}

app.use('*', logger())

app.use(
  '*',
  cors({
    origin: frontendUrl,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

app.use('*', async (c, next) => {
  const ip = getClientIp(c.req.header('x-forwarded-for'), c.req.header('x-real-ip'))
  const now = Date.now()

  const current = requestStore.get(ip)

  if (!current || now >= current.resetAt) {
    requestStore.set(ip, { count: 1, resetAt: now + rateLimitWindowMs })
  } else {
    if (current.count >= rateLimitMax) {
      return c.json({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' }, 429)
    }

    current.count += 1
    requestStore.set(ip, current)
  }

  await next()
})

app.get('/health', async (c) => {
  try {
    const block = await getLastProcessedBlock()
    return c.json({ status: 'ok', block: block.toString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message, code: 'INTERNAL_ERROR' }, 500)
  }
})

app.route('/api/posts', postsRouter)
app.route('/api/users', usersRouter)
app.route('/api/wagers', wagersRouter)
app.route('/api/uploads', uploadsRouter)

app.notFound((c) => c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404))

app.onError((error, c) => {
  return c.json({ error: error.message, code: 'INTERNAL_ERROR' }, 500)
})

const port = Number(process.env.PORT ?? 3001)

const stopListener = startEventListener()

const server = serve({
  fetch: app.fetch,
  port,
})

console.log(`[api] RoastWager backend running on http://localhost:${port}`)

const shutdown = (): void => {
  console.log('[api] shutting down...')
  stopListener()
  server.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

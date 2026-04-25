import { getWagersByPost, updatePost, updateWager } from '../db/supabase.js'

interface RefundedArgs {
  postId: unknown
}

interface RefundedLog {
  args: RefundedArgs
}

interface LegacyRefundedInput {
  postId: bigint
}

function normalizePostId(value: unknown): string {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string') return value.startsWith('0x') ? value.toLowerCase() : value
  throw new Error('Invalid postId')
}

function normalizeInput(input: RefundedLog | LegacyRefundedInput): { postId: string } {
  if ('args' in input) {
    return { postId: normalizePostId(input.args.postId) }
  }

  return { postId: input.postId.toString() }
}

export async function handleRefunded(input: RefundedLog | LegacyRefundedInput): Promise<void> {
  try {
    const normalized = normalizeInput(input)

    await updatePost(normalized.postId, {
      status: 'refunded',
      winningSide: undefined,
    })

    const wagers = await getWagersByPost(normalized.postId)

    for (const wager of wagers) {
      if (wager.result !== 'refund') {
        await updateWager(wager.id, { result: 'refund' })
      }
    }

    console.log('[EVENT] Refunded:', normalized.postId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`[handleRefunded] ${message}`)
  }
}

import { updateWager } from '../db/supabase.js'

interface ClaimedArgs {
  postId: unknown
  voter: unknown
  amount: unknown
}

interface ClaimedLog {
  args: ClaimedArgs
}

interface LegacyClaimedInput {
  postId: bigint
  voter: `0x${string}`
  amount: bigint
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

function normalizePostId(value: unknown): string {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string') return value.startsWith('0x') ? value.toLowerCase() : value
  throw new Error('Invalid postId')
}

function normalizeInput(input: ClaimedLog | LegacyClaimedInput): {
  postId: string
  voter: string
  amount: string
} {
  if ('args' in input) {
    return {
      postId: normalizePostId(input.args.postId),
      voter: asString(input.args.voter, 'voter').toLowerCase(),
      amount: asBigint(input.args.amount, 'amount').toString(),
    }
  }

  return {
    postId: input.postId.toString(),
    voter: input.voter.toLowerCase(),
    amount: input.amount.toString(),
  }
}

export async function handleClaimed(input: ClaimedLog | LegacyClaimedInput): Promise<void> {
  try {
    const normalized = normalizeInput(input)
    const wagerId = `${normalized.postId}-${normalized.voter}`

    await updateWager(wagerId, {
      payout: normalized.amount,
    })

    console.log('[EVENT] Claimed:', normalized.postId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`[handleClaimed] ${message}`)
  }
}

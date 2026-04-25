import {
  getPostById,
  getUser,
  getWagersByPost,
  updatePost,
  updateWager,
  upsertUser,
} from '../db/supabase.js'
import type { Side, User } from '../types/index.js'

interface ResolvedArgs {
  postId: unknown
  winningSide: unknown
}

interface ResolvedLog {
  args: ResolvedArgs
}

interface LegacyResolvedInput {
  postId: bigint
  winningSide: boolean
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

function normalizeWinningSide(value: unknown): 1 | 2 {
  if (typeof value === 'bigint') {
    if (value === 1n) return 1
    if (value === 2n) return 2
  }

  if (typeof value === 'number') {
    if (value === 1) return 1
    if (value === 2) return 2
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 2
  }

  throw new Error('Invalid winningSide')
}

function normalizeInput(input: ResolvedLog | LegacyResolvedInput): {
  postId: string
  winningSide: 1 | 2
} {
  if ('args' in input) {
    return {
      postId: normalizePostId(input.args.postId),
      winningSide: normalizeWinningSide(input.args.winningSide),
    }
  }

  return {
    postId: input.postId.toString(),
    winningSide: input.winningSide ? 1 : 2,
  }
}

function getLevel(xp: number): number {
  if (xp >= 10000) return 5
  if (xp >= 2000) return 4
  if (xp >= 500) return 3
  if (xp >= 100) return 2
  return 1
}

export async function handleResolved(input: ResolvedLog | LegacyResolvedInput): Promise<void> {
  try {
    const normalized = normalizeInput(input)

    const post = await getPostById(normalized.postId)
    if (!post) {
      throw new Error(`Post not found: ${normalized.postId}`)
    }

    const winningSideLabel: Side = normalized.winningSide === 1 ? 'bull' : 'bear'

    await updatePost(normalized.postId, {
      status: 'settled',
      winningSide: winningSideLabel,
    })

    const allWagers = await getWagersByPost(normalized.postId)
    const pendingWagers = allWagers.filter((wager) => wager.result === 'pending')

    let winnerCount = 0
    let loserCount = 0

    for (const wager of pendingWagers) {
      const isWin =
        (normalized.winningSide === 1 && wager.side === 'bull') ||
        (normalized.winningSide === 2 && wager.side === 'bear')

      await updateWager(wager.id, {
        result: isWin ? 'win' : 'lose',
      })

      const user = await getUser(wager.userAddress)
      const currentXP = user?.experience ?? 0
      const nextXP = currentXP + (isWin ? 25 : 5)

      const nextUser: User = {
        id: wager.userAddress.toLowerCase(),
        level: getLevel(nextXP),
        experience: nextXP,
        lastWagerAt: user?.lastWagerAt ?? '0',
      }

      await upsertUser(nextUser)

      if (isWin) {
        winnerCount += 1
      } else {
        loserCount += 1
      }
    }

    console.log(`[EVENT] Resolved: ${normalized.postId} | ${winnerCount} winners, ${loserCount} losers`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`[handleResolved] ${message}`)
  }
}

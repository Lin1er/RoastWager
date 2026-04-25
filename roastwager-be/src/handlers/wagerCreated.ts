import { publicClient } from '../lib/viemClient.js'
import { createPost, getPostById } from '../db/supabase.js'
import type { Post } from '../types/index.js'

interface WagerCreatedArgs {
  postId: unknown
  creator: unknown
  content: unknown
  imageUrl: unknown
  endTime: unknown
}

interface WagerCreatedLog {
  args: WagerCreatedArgs
  blockNumber?: bigint | null
  blockTimestamp?: bigint | null
}

interface LegacyWagerCreatedInput {
  postId: bigint
  creator: `0x${string}`
  content: string
  imageUrl: string
  endTime: bigint
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

function normalizePostId(value: unknown): string {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string') return value.startsWith('0x') ? value.toLowerCase() : value
  throw new Error('Invalid postId')
}

function normalizeInput(input: WagerCreatedLog | LegacyWagerCreatedInput): {
  postId: string
  creator: string
  content: string
  imageUrl: string
  endTime: string
  blockNumber?: bigint
  blockTimestamp?: bigint
} {
  if ('args' in input) {
    return {
      postId: normalizePostId(input.args.postId),
      creator: asString(input.args.creator, 'creator').toLowerCase(),
      content: asString(input.args.content, 'content'),
      imageUrl: asString(input.args.imageUrl, 'imageUrl'),
      endTime: asBigint(input.args.endTime, 'endTime').toString(),
      blockNumber: input.blockNumber ?? undefined,
      blockTimestamp: input.blockTimestamp ?? undefined,
    }
  }

  return {
    postId: input.postId.toString(),
    creator: input.creator.toLowerCase(),
    content: input.content,
    imageUrl: input.imageUrl,
    endTime: input.endTime.toString(),
    blockTimestamp: input.blockTimestamp !== undefined ? BigInt(input.blockTimestamp) : undefined,
  }
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

export async function handleWagerCreated(input: WagerCreatedLog | LegacyWagerCreatedInput): Promise<void> {
  try {
    const normalized = normalizeInput(input)

    const existingPost = await getPostById(normalized.postId)
    if (existingPost) {
      return
    }

    const createdAt = await resolveTimestamp(normalized.blockNumber, normalized.blockTimestamp)

    const newPost: Omit<Post, 'winningSide'> = {
      id: normalized.postId,
      creator: normalized.creator,
      content: normalized.content,
      imageUrl: normalized.imageUrl.length > 0 ? normalized.imageUrl : null,
      endTime: normalized.endTime,
      status: 'active',
      bullPool: '0',
      bearPool: '0',
      bullCount: 0,
      bearCount: 0,
      createdAt,
    }

    await createPost(newPost)

    console.log('[EVENT] WagerCreated:', normalized.postId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`[handleWagerCreated] ${message}`)
  }
}

import 'dotenv/config'

const contractAddress = process.env.CONTRACT_ADDRESS?.trim().toLowerCase()

if (!contractAddress) {
  throw new Error('Missing CONTRACT_ADDRESS')
}

const postPrefix = `${contractAddress}:`
const wagerPrefix = `${contractAddress}:`

export const currentContractScope = contractAddress
export const scopedPostLikePattern = `${postPrefix}%`
export const scopedWagerLikePattern = `${wagerPrefix}%`

export function scopePostId(postId: string): string {
  if (postId.startsWith(postPrefix)) {
    return postId
  }

  return `${postPrefix}${postId}`
}

export function unscopePostId(value: string): string {
  if (value.startsWith(postPrefix)) {
    return value.slice(postPrefix.length)
  }

  const separatorIndex = value.lastIndexOf(':')
  return separatorIndex === -1 ? value : value.slice(separatorIndex + 1)
}

export function scopeWagerId(id: string): string {
  if (id.startsWith(wagerPrefix)) {
    return id
  }

  return `${wagerPrefix}${id}`
}

export function unscopeWagerId(value: string): string {
  if (value.startsWith(wagerPrefix)) {
    return value.slice(wagerPrefix.length)
  }

  return value
}

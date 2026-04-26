import 'dotenv/config'
import { createPublicClient, defineChain, http } from 'viem'

export const rpcUrl = process.env.CELO_RPC_URL ?? process.env.MONAD_RPC_URL

if (!rpcUrl) {
  throw new Error('Missing CELO_RPC_URL')
}

const rawChainId = process.env.CELO_CHAIN_ID ?? process.env.MONAD_CHAIN_ID
const defaultCeloMainnetChainId = 42220
const parsedChainId = rawChainId ? Number(rawChainId) : defaultCeloMainnetChainId

if (!Number.isInteger(parsedChainId) || parsedChainId <= 0) {
  throw new Error('Invalid CELO_CHAIN_ID')
}

export const celoMainnet = defineChain({
  id: parsedChainId,
  name: 'Celo Mainnet',
  nativeCurrency: {
    name: 'CELO',
    symbol: 'CELO',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [rpcUrl],
    },
  },
})

export const publicClient = createPublicClient({
  chain: celoMainnet,
  transport: http(rpcUrl),
})

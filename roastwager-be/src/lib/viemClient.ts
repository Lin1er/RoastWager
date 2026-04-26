import 'dotenv/config'
import { createPublicClient, defineChain, http } from 'viem'

export const rpcUrl = process.env.MONAD_RPC_URL

if (!rpcUrl) {
  throw new Error('Missing MONAD_RPC_URL')
}

const rawChainId = process.env.MONAD_CHAIN_ID
const defaultMonadTestnetChainId = 10143
const parsedChainId = rawChainId ? Number(rawChainId) : defaultMonadTestnetChainId

if (!Number.isInteger(parsedChainId) || parsedChainId <= 0) {
  throw new Error('Invalid MONAD_CHAIN_ID')
}

export const monadTestnet = defineChain({
  id: parsedChainId,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [rpcUrl],
    },
  },
})

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(rpcUrl),
})

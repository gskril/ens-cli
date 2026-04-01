import { z } from 'incur'
import { createEnsClient } from './client.ts'
import type { Chain } from './contracts.ts'

export const globalOptions = z.object({
  rpc: z.string().optional().describe('Ethereum RPC URL'),
  chain: z.enum(['mainnet', 'sepolia']).default('mainnet').describe('Chain to use'),
  universalResolver: z.string().optional().describe('Custom Universal Resolver contract address'),
})

export const globalEnv = z.object({
  ETH_RPC_URL: z.string().optional().describe('Ethereum RPC URL (fallback if --rpc not provided)'),
})

export function clientFromContext(c: {
  options: { rpc?: string; chain?: string }
  env: { ETH_RPC_URL?: string }
}) {
  const chain = (c.options.chain ?? 'mainnet') as Chain
  const rpc = c.options.rpc ?? c.env.ETH_RPC_URL
  return { client: createEnsClient({ rpc, chain }), chain }
}

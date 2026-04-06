import { z } from 'incur'
import { createEnsClient } from './client.ts'
import { addresses, baseRegistrarAbi, type Chain } from './contracts.ts'

export const globalOptions = z.object({
  rpc: z.string().optional().describe('Ethereum RPC URL'),
  chain: z.enum(['mainnet', 'sepolia']).default('mainnet').describe('Chain to use'),
  universalResolver: z.string().optional().describe('Custom Universal Resolver contract address'),
})

export const globalEnv = z.object({
  ETH_RPC_URL: z.string().optional().describe('Ethereum RPC URL (fallback if --rpc not provided)'),
})

type Context = {
  options: { rpc?: string; chain?: string }
  env: { ETH_RPC_URL?: string }
}

export function clientFromContext(c: Context) {
  const chain = (c.options.chain ?? 'mainnet') as Chain
  const rpc = c.options.rpc ?? c.env.ETH_RPC_URL
  return { client: createEnsClient({ rpc, chain }), chain }
}

// Switch to help with logic around ENSv2
// Check if the latest BaseRegistrar is active
export async function isV2Active(c: Context) {
  const { client, chain } = clientFromContext(c)

  try {
    const isControllerActive = await client.readContract({
      address: addresses[chain].baseRegistrar,
      abi: baseRegistrarAbi,
      functionName: 'controllers',
      args: [addresses[chain].controller],
    })

    // If the controller is active then v2 is not active, so return the opposite
    return !isControllerActive
  } catch {
    // If the v1 BaseRegistrar does not exist in a custom deployment, assume v2 is active
    return true
  }
}

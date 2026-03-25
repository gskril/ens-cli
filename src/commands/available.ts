import { z } from 'incur'
import { ethRegistrarControllerAbi, addresses, type Chain } from '../lib/contracts.ts'
import type { createEnsClient } from '../lib/client.ts'

type Client = ReturnType<typeof createEnsClient>

function extractLabel(name: string): string {
  return name.replace(/\.eth$/, '')
}

export function availableCommand(getClient: () => Client, getChain: () => Chain) {
  return {
    description: 'Check if an ENS name is available for registration',
    args: z.object({
      name: z.string().describe('ENS name to check (e.g. myname.eth)'),
    }),
    async run(c: any) {
      const client = getClient()
      const chain = getChain()
      const label = extractLabel(c.args.name)
      const available = await client.readContract({
        address: addresses[chain].controller,
        abi: ethRegistrarControllerAbi,
        functionName: 'available',
        args: [label],
      })
      return { name: c.args.name, label, available }
    },
  }
}

import { z } from 'incur'
import { formatEther } from 'viem'
import { ethRegistrarControllerAbi, addresses, type Chain } from '../lib/contracts.ts'
import type { createEnsClient } from '../lib/client.ts'

type Client = ReturnType<typeof createEnsClient>

const ONE_YEAR = 31536000n

function extractLabel(name: string): string {
  return name.replace(/\.eth$/, '')
}

export function priceCommand(getClient: () => Client, getChain: () => Chain) {
  return {
    description:
      'Check the registration or renewal cost for an ENS name. Run this before register or renew to determine the value to send.',
    args: z.object({
      name: z.string().describe('ENS name to price (e.g. myname.eth)'),
    }),
    options: z.object({
      duration: z.coerce
        .bigint()
        .optional()
        .describe('Registration duration in seconds (default: 31536000 = 1 year)'),
    }),
    alias: { duration: 'd' },
    async run(c: any) {
      const client = getClient()
      const chain = getChain()
      const label = extractLabel(c.args.name)
      const duration = c.options.duration ?? ONE_YEAR
      const price = await client.readContract({
        address: addresses[chain].controller,
        abi: ethRegistrarControllerAbi,
        functionName: 'rentPrice',
        args: [label, duration],
      })
      const total = price.base + price.premium
      return {
        name: c.args.name,
        label,
        duration: duration.toString(),
        base: price.base.toString(),
        premium: price.premium.toString(),
        total: total.toString(),
        totalEth: formatEther(total),
      }
    },
  }
}

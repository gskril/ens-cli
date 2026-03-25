import { z } from 'incur'
import { formatEther } from 'viem'
import { ethRegistrarControllerAbi, addresses } from '../lib/contracts.ts'
import { globalOptions, globalEnv, clientFromContext } from '../lib/context.ts'
import { extractLabel } from '../lib/utils.ts'

const ONE_YEAR = 31536000n

export const priceCommand = {
  description:
    'Check the registration or renewal cost for an ENS name. Run this before register or renew to determine the value to send.',
  args: z.object({
    name: z.string().describe('ENS name to price (e.g. myname.eth)'),
  }),
  options: globalOptions.merge(
    z.object({
      duration: z.coerce
        .bigint()
        .optional()
        .describe('Registration duration in seconds (default: 31536000 = 1 year)'),
    }),
  ),
  env: globalEnv,
  alias: { duration: 'd' },
  async run(c: any) {
    const { client, chain } = clientFromContext(c)
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

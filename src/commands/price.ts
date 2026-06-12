import { z } from 'incur'
import { formatEther, formatUnits } from 'viem/utils'
import { ethRegistrarAbi, ethRegistrarControllerAbi, addresses } from '../lib/contracts.ts'
import {
  globalOptions,
  globalEnv,
  clientFromContext,
  isV2Active,
  v2DeploymentForChain,
} from '../lib/context.ts'
import { extractLabel } from '../lib/utils.ts'
import { erc20Abi } from 'viem'

const ONE_YEAR = 31536000n

export const priceCommand = {
  description:
    'Check the registration or renewal cost for an ENS name. Returns a bufferedTotal (with 5% buffer) to use as the transaction value. IMPORTANT: Always fetch price immediately before sending the register/renew transaction, not earlier, because ENS prices are denominated in USD but paid in ETH, so the required ETH amount changes with the ETH/USD price.',
  args: z.object({
    name: z.string().describe('ENS name to price (e.g. myname.eth)'),
  }),
  options: globalOptions.merge(
    z.object({
      duration: z.coerce
        .number()
        .optional()
        .describe('Registration duration in seconds (default: 31536000 = 1 year)'),
      paymentToken: z
        .string()
        .optional()
        .describe('ERC-20 payment token for ENSv2 registration pricing'),
    }),
  ),
  env: globalEnv,
  alias: { duration: 'd', paymentToken: 'p' },
  async run(c: any) {
    const { client, chain } = clientFromContext(c)
    const label = extractLabel(c.args.name)
    const duration = c.options.duration != null ? BigInt(c.options.duration) : ONE_YEAR
    const { isV2 } = await isV2Active(c, c.options.universalResolver as `0x${string}` | undefined)
    const v2Deployment = isV2 ? v2DeploymentForChain(chain) : undefined

    if (v2Deployment) {
      const paymentToken = (c.options.paymentToken ?? v2Deployment.paymentToken) as `0x${string}`
      const price = await client.readContract({
        address: v2Deployment.registrar,
        abi: ethRegistrarAbi,
        functionName: 'getRegisterPrice',
        args: [label, duration, paymentToken],
      })
      const total = price[0] + price[1]

      let symbol: string | null = null
      let decimals: number | null = null
      try {
        ;[symbol, decimals] = await Promise.all([
          client.readContract({
            address: paymentToken,
            abi: erc20Abi,
            functionName: 'symbol',
          }),
          client.readContract({
            address: paymentToken,
            abi: erc20Abi,
            functionName: 'decimals',
          }),
        ])
      } catch {
        // Some ERC-20s omit metadata. Raw amounts are still returned below.
      }

      const result = {
        name: c.args.name,
        label,
        duration: duration.toString(),
        base: price[0].toString(),
        premium: price[1].toString(),
        total: total.toString(),
        paymentToken,
        tokenSymbol: symbol,
        tokenDecimals: decimals,
        totalFormatted: decimals == null ? null : formatUnits(total, decimals),
        registry: v2Deployment.registry,
        registrar: v2Deployment.registrar,
        version: 'v2',
        note: 'ENSv2 registration is paid with an ERC-20. Approve the registrar to spend total, then call register reveal with the same paymentToken. Do not send ETH value.',
      }

      if (
        chain === 'sepolia' &&
        paymentToken.toLowerCase() === v2Deployment.paymentToken.toLowerCase()
      ) {
        return c.ok({
          ...result,
          testTokenHint:
            'Sepolia uses a dummy USDC ERC-20 for ENSv2 testing. It has open minting, so mint test tokens before approving the registrar.',
          testTokenMint: {
            token: paymentToken,
            function: 'mint(address,uint256)',
            amount: total.toString(),
            amountFormatted: decimals == null ? null : formatUnits(total, decimals),
            example: `cast send ${paymentToken} "mint(address,uint256)" <your-address> ${total.toString()} --rpc-url <sepolia-rpc> --private-key <key>`,
          },
        })
      }

      return result
    }

    const price = await client.readContract({
      address: addresses[chain].controller,
      abi: ethRegistrarControllerAbi,
      functionName: 'rentPrice',
      args: [label, duration],
    })
    const total = price.base + price.premium
    const buffered = total + total / 20n // 5% buffer for ETH price changes
    return {
      name: c.args.name,
      label,
      duration: duration.toString(),
      base: price.base.toString(),
      premium: price.premium.toString(),
      total: total.toString(),
      totalEth: formatEther(total),
      bufferedTotal: buffered.toString(),
      bufferedTotalEth: formatEther(buffered),
      note: 'bufferedTotal includes a 5% buffer to account for ETH price fluctuations. Use bufferedTotal as the value for register/renew transactions. Any excess ETH is refunded by the contract.',
    }
  },
}

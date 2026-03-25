import { Cli, z } from 'incur'
import { encodeFunctionData, toHex } from 'viem'
import { ethRegistrarControllerAbi, addresses, type Chain } from '../lib/contracts.ts'
import type { createEnsClient } from '../lib/client.ts'

type Client = ReturnType<typeof createEnsClient>

const ONE_YEAR = 31536000n
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const

function extractLabel(name: string): string {
  return name.replace(/\.eth$/, '')
}

function generateSecret(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

type Registration = {
  label: string
  owner: `0x${string}`
  duration: bigint
  secret: `0x${string}`
  resolver: `0x${string}`
  data: readonly `0x${string}`[]
  reverseRecord: number
  referrer: `0x${string}`
}

function buildRegistration(opts: {
  label: string
  owner: `0x${string}`
  duration: bigint
  secret: `0x${string}`
  resolver: `0x${string}`
  reverseRecord: boolean
}): Registration {
  return {
    label: opts.label,
    owner: opts.owner,
    duration: opts.duration,
    secret: opts.secret,
    resolver: opts.resolver,
    data: [],
    reverseRecord: opts.reverseRecord ? 1 : 0,
    referrer: ZERO_BYTES32,
  }
}

export function registerCommands(getClient: () => Client, getChain: () => Chain) {
  return Cli.create('register', {
    description: 'ENS name registration (commit/reveal flow)',
  })
    .command('commit', {
      description:
        'Generate the commitment transaction for registering an ENS name. Returns calldata JSON and a secret that MUST be saved for the reveal step. Wait at least 60 seconds after the commit transaction is mined before calling reveal.',
      args: z.object({
        name: z.string().describe('ENS name to register (e.g. myname.eth)'),
        owner: z.string().describe('Address that will own the name'),
      }),
      options: z.object({
        duration: z.coerce
          .bigint()
          .optional()
          .describe('Registration duration in seconds (default: 31536000 = 1 year)'),
        secret: z.string().optional().describe('Secret bytes32 hex (auto-generated if omitted)'),
        resolver: z
          .string()
          .optional()
          .describe('Resolver address (defaults to chain public resolver)'),
        reverseRecord: z.boolean().optional().describe('Set reverse record (default: false)'),
      }),
      alias: { duration: 'd', secret: 's', resolver: 'r' },
      async run(c) {
        const client = getClient()
        const chain = getChain()
        const controllerAddress = addresses[chain].controller
        const label = extractLabel(c.args.name)
        const owner = c.args.owner as `0x${string}`
        const duration = c.options.duration ?? ONE_YEAR
        const secret = (c.options.secret ?? generateSecret()) as `0x${string}`
        const resolver = (c.options.resolver ?? addresses[chain].resolver) as `0x${string}`
        const reverseRecord = c.options.reverseRecord ?? false

        const registration = buildRegistration({
          label,
          owner,
          duration,
          secret,
          resolver,
          reverseRecord,
        })

        const commitment = await client.readContract({
          address: controllerAddress,
          abi: ethRegistrarControllerAbi,
          functionName: 'makeCommitment',
          args: [registration],
        })

        const data = encodeFunctionData({
          abi: ethRegistrarControllerAbi,
          functionName: 'commit',
          args: [commitment],
        })

        return {
          to: controllerAddress,
          data,
          value: '0',
          secret,
          commitment,
          name: c.args.name,
          label,
          owner,
          duration: duration.toString(),
          resolver,
          reverseRecord,
        }
      },
    })
    .command('reveal', {
      description:
        'Generate the registration transaction to reveal a committed ENS name. Requires the secret from the commit step and a value (in wei) from the price command.',
      args: z.object({
        name: z.string().describe('ENS name to register (e.g. myname.eth)'),
        owner: z.string().describe('Address that will own the name'),
      }),
      options: z.object({
        secret: z.string().describe('Secret from the commit step (required)'),
        value: z.string().describe('ETH value in wei to send (get from ens price)'),
        duration: z.coerce
          .bigint()
          .optional()
          .describe('Registration duration in seconds (must match commit)'),
        resolver: z.string().optional().describe('Resolver address (must match commit)'),
        reverseRecord: z.boolean().optional().describe('Set reverse record (must match commit)'),
      }),
      alias: { duration: 'd', secret: 's', resolver: 'r', value: 'v' },
      async run(c) {
        const chain = getChain()
        const controllerAddress = addresses[chain].controller
        const label = extractLabel(c.args.name)
        const owner = c.args.owner as `0x${string}`
        const duration = c.options.duration ?? ONE_YEAR
        const secret = c.options.secret as `0x${string}`
        const resolver = (c.options.resolver ?? addresses[chain].resolver) as `0x${string}`
        const reverseRecord = c.options.reverseRecord ?? false

        const registration = buildRegistration({
          label,
          owner,
          duration,
          secret,
          resolver,
          reverseRecord,
        })

        const data = encodeFunctionData({
          abi: ethRegistrarControllerAbi,
          functionName: 'register',
          args: [registration],
        })

        return {
          to: controllerAddress,
          data,
          value: c.options.value,
          name: c.args.name,
          label,
          owner,
          duration: duration.toString(),
        }
      },
    })
}

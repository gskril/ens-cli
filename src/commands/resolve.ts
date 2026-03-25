import { z } from 'incur'
import { normalize } from 'viem/ens'
import { getEnsAddress, getEnsName, getEnsText, getEnsAvatar } from 'viem/ens'
import type { createEnsClient } from '../lib/client.ts'

type Client = ReturnType<typeof createEnsClient>

export function resolveCommand(getClient: () => Client) {
  return {
    description: 'Resolve an ENS name to an address',
    args: z.object({
      name: z.string().describe('ENS name to resolve (e.g. vitalik.eth)'),
    }),
    options: z.object({
      coinType: z.coerce.number().optional().describe('ENSIP-9 coin type (default: 60 for ETH)'),
    }),
    alias: { coinType: 'c' },
    async run(c: any) {
      const client = getClient()
      const name = normalize(c.args.name)
      const address = await getEnsAddress(client, {
        name,
        ...(c.options.coinType != null ? { coinType: c.options.coinType } : {}),
      })
      return {
        name,
        address,
        ...(c.options.coinType != null ? { coinType: c.options.coinType } : {}),
      }
    },
  }
}

export function reverseCommand(getClient: () => Client) {
  return {
    description: 'Reverse resolve an address to an ENS name',
    args: z.object({
      address: z.string().describe('Ethereum address to reverse resolve'),
    }),
    options: z.object({
      coinType: z.coerce.number().optional().describe('ENSIP-9 coin type (default: 60 for ETH)'),
    }),
    alias: { coinType: 'c' },
    async run(c: any) {
      const client = getClient()
      const address = c.args.address as `0x${string}`
      const name = await getEnsName(client, {
        address,
        ...(c.options.coinType != null ? { coinType: c.options.coinType } : {}),
      })
      return {
        address,
        name,
        ...(c.options.coinType != null ? { coinType: c.options.coinType } : {}),
      }
    },
  }
}

export function textCommand(getClient: () => Client) {
  return {
    description: 'Get a text record for an ENS name',
    args: z.object({
      name: z.string().describe('ENS name (e.g. vitalik.eth)'),
      key: z.string().describe('Text record key (e.g. com.twitter, url, description)'),
    }),
    async run(c: any) {
      const client = getClient()
      const name = normalize(c.args.name)
      const value = await getEnsText(client, { name, key: c.args.key })
      return { name, key: c.args.key, value }
    },
  }
}

export function avatarCommand(getClient: () => Client) {
  return {
    description: 'Get the avatar URL for an ENS name',
    args: z.object({
      name: z.string().describe('ENS name (e.g. vitalik.eth)'),
    }),
    async run(c: any) {
      const client = getClient()
      const name = normalize(c.args.name)
      const avatar = await getEnsAvatar(client, { name })
      return { name, avatar }
    },
  }
}

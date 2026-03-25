import { Cli, z } from 'incur'
import { createEnsClient } from './lib/client.ts'
import type { Chain } from './lib/contracts.ts'
import { resolveCommand, reverseCommand, textCommand, avatarCommand } from './commands/resolve.ts'
import { availableCommand } from './commands/available.ts'
import { priceCommand } from './commands/price.ts'
import { registerCommands } from './commands/register.ts'
import { renewCommand } from './commands/renew.ts'
import { setCommands } from './commands/set.ts'

let cachedClient: ReturnType<typeof createEnsClient> | undefined

function parseGlobalArgs() {
  const args = process.argv
  let rpc: string | undefined
  let chain: Chain = 'mainnet'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rpc' && args[i + 1]) rpc = args[i + 1]
    if (args[i] === '--chain' && args[i + 1]) chain = args[i + 1] as Chain
  }

  rpc ??= process.env.ETH_RPC_URL
  return { rpc, chain }
}

function getClient() {
  if (!cachedClient) {
    const { rpc, chain } = parseGlobalArgs()
    cachedClient = createEnsClient({ rpc, chain })
  }
  return cachedClient
}

function getChain(): Chain {
  return parseGlobalArgs().chain
}

export const cli = Cli.create('ens', {
  version: '0.1.0',
  description:
    'ENS CLI for resolving names, checking availability, generating registration and record-setting calldata. Designed for autonomous agents. Use --rpc <url> or ETH_RPC_URL env var to set the RPC endpoint. Use --chain mainnet|sepolia to select the network.',
})
  // Resolution
  .command('resolve', resolveCommand(getClient))
  .command('reverse', reverseCommand(getClient))
  .command('text', textCommand(getClient))
  .command('avatar', avatarCommand(getClient))
  // Queries
  .command('available', availableCommand(getClient, getChain))
  .command('price', priceCommand(getClient, getChain))
  // Write operations (calldata output)
  .command('renew', renewCommand(getChain))
  .command(registerCommands(getClient, getChain))
  .command(setCommands(getChain))

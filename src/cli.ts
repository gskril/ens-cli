import { Cli } from 'incur'
import packageJson from '../package.json'
import { resolveCommand, reverseCommand, textCommand, avatarCommand } from './commands/resolve.ts'
import { availableCommand } from './commands/available.ts'
import { priceCommand } from './commands/price.ts'
import { registerCommands } from './commands/register.ts'
import { renewCommand } from './commands/renew.ts'
import { resolverCommands } from './commands/resolver.ts'
import { setCommands } from './commands/set.ts'
import { subnameCommands } from './commands/subname.ts'
import { whoisCommand } from './commands/whois.ts'

export const cli = Cli.create('ens', {
  version: packageJson.version,
  description:
    'ENS CLI for resolving names, checking availability, generating registration and record-setting calldata. Designed for autonomous agents. Use --rpc <url> or ETH_RPC_URL env var to set the RPC endpoint. Use --chain mainnet|sepolia to select the network.',
  mcp: {
    command: 'npx "https://pkg.pr.new/gskril/ens-cli/@ensdomains/cli@main" --mcp',
  },
})
  // Resolution
  .command(resolveCommand)
  .command(reverseCommand)
  .command(textCommand)
  .command(avatarCommand)
  // Queries
  .command(availableCommand)
  .command(priceCommand)
  .command(whoisCommand)
  // Write operations (calldata output)
  .command(renewCommand)
  .command(registerCommands)
  .command(resolverCommands)
  .command(setCommands)
  .command(subnameCommands)

import { z } from 'incur'
import { ethRegistrarAbi, ethRegistrarControllerAbi, addresses } from '../lib/contracts.ts'
import {
  globalOptions,
  globalEnv,
  clientFromContext,
  isV2Active,
  v2DeploymentForChain,
} from '../lib/context.ts'
import { extractLabel } from '../lib/utils.ts'

export const availableCommand = {
  description: 'Check if an ENS name is available for registration',
  args: z.object({
    name: z.string().describe('ENS name to check (e.g. myname.eth)'),
  }),
  options: globalOptions,
  env: globalEnv,
  async run(c: any) {
    const { client, chain } = clientFromContext(c)
    const label = extractLabel(c.args.name)
    const { isV2 } = await isV2Active(c, c.options.universalResolver as `0x${string}` | undefined)
    const v2Deployment = isV2 ? v2DeploymentForChain(chain) : undefined

    if (v2Deployment) {
      const available = await client.readContract({
        address: v2Deployment.registrar,
        abi: ethRegistrarAbi,
        functionName: 'isAvailable',
        args: [label],
      })
      return {
        name: c.args.name,
        label,
        available,
        registry: v2Deployment.registry,
        registrar: v2Deployment.registrar,
        version: 'v2',
      }
    }

    const available = await client.readContract({
      address: addresses[chain].controller,
      abi: ethRegistrarControllerAbi,
      functionName: 'available',
      args: [label],
    })
    return { name: c.args.name, label, available }
  },
}

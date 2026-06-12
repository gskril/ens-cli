import { Cli, z } from 'incur'
import {
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  getContractAddress,
  isAddressEqual,
  isHex,
  keccak256,
  stringToBytes,
  toHex,
} from 'viem/utils'
import { labelhash, namehash } from 'viem/ens'
import {
  addresses,
  ensRegistryAbi,
  nameWrapperAbi,
  permissionedResolverAbi,
  v2RegistryAbi,
  verifiableFactoryAbi,
} from '../lib/contracts.ts'
import {
  globalOptions,
  globalEnv,
  clientFromContext,
  isV2Active,
  v2DeploymentForChain,
} from '../lib/context.ts'
import { validateName } from '../lib/utils.ts'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

const DEFAULT_ROLE_BITMAP = BigInt(
  '0x1111111111111111111111111111111111111111111111111111111111111111',
)

function parseSalt(salt: string | undefined, deployer: `0x${string}`): bigint {
  if (salt) return BigInt(salt)
  return BigInt(keccak256(stringToBytes(`ens-v2-resolver:${deployer.toLowerCase()}`)))
}

function parseRoleBitmap(value: string | undefined): bigint {
  if (value == null) return DEFAULT_ROLE_BITMAP
  return BigInt(value)
}

function computeProxyAddress(opts: {
  factory: `0x${string}`
  proxyLogic: `0x${string}`
  deployer: `0x${string}`
  salt: bigint
}) {
  const outerSalt = keccak256(
    encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [opts.deployer, opts.salt]),
  )
  const bytecode = concat([
    '0x3d604d80600a3d3981f3363d3d373d3d3d363d73',
    opts.proxyLogic,
    '0x5af43d82803e903d91602b57fd5bf3',
    outerSalt,
  ])

  return {
    address: getContractAddress({
      bytecode,
      from: opts.factory,
      opcode: 'CREATE2',
      salt: outerSalt,
    }),
    outerSalt,
  }
}

export const resolverCommands = Cli.create('resolver', {
  description: 'ENSv2 resolver utilities',
})
  .command('deploy', {
    description:
      'Generate calldata to deploy a per-account permissioned resolver via the ENSv2 VerifiableFactory. The resolver address is determined by (factory, proxyLogic, deployer, salt) and must be deployed from the deployer address. If a resolver already exists at the predicted address, returns alreadyDeployed=true with no transaction needed.',
    args: z.object({
      deployer: z
        .string()
        .describe(
          'Address that will send the deployment transaction. The resolver address depends on this — sending from a different account produces a different resolver.',
        ),
    }),
    options: globalOptions.merge(
      z.object({
        admin: z
          .string()
          .optional()
          .describe('Admin address granted role bitmap on the resolver (default: deployer)'),
        salt: z
          .string()
          .optional()
          .describe(
            'CREATE2 salt as decimal or 0x hex (default: keccak256("ens-v2-resolver:<deployer>"))',
          ),
        roleBitmap: z
          .string()
          .optional()
          .describe('Role bitmap granted to the admin as decimal or 0x hex (default: 0x1111…1111)'),
      }),
    ),
    env: globalEnv,
    alias: { admin: 'a', salt: 's' },
    async run(c) {
      const { client, chain } = clientFromContext(c)
      const v2Deployment = v2DeploymentForChain(chain)
      if (!v2Deployment) {
        throw new Error(`ENSv2 resolver deployment is not configured for chain "${chain}"`)
      }

      const deployer = c.args.deployer as `0x${string}`
      const admin = (c.options.admin ?? deployer) as `0x${string}`
      const salt = parseSalt(c.options.salt, deployer)
      const roleBitmap = parseRoleBitmap(c.options.roleBitmap)

      const initializeData = encodeFunctionData({
        abi: permissionedResolverAbi,
        functionName: 'initialize',
        args: [admin, roleBitmap],
      })
      const data = encodeFunctionData({
        abi: verifiableFactoryAbi,
        functionName: 'deployProxy',
        args: [v2Deployment.resolverImplementation, salt, initializeData],
      })
      const proxy = computeProxyAddress({
        factory: v2Deployment.resolverFactory,
        proxyLogic: v2Deployment.resolverProxyLogic,
        deployer,
        salt,
      })

      const code = await client.getCode({ address: proxy.address })
      const alreadyDeployed = isHex(code) && code !== '0x'

      return {
        to: v2Deployment.resolverFactory,
        data,
        value: '0',
        resolver: proxy.address,
        alreadyDeployed,
        chain,
        factory: v2Deployment.resolverFactory,
        implementation: v2Deployment.resolverImplementation,
        proxyLogic: v2Deployment.resolverProxyLogic,
        deployer,
        admin,
        salt: salt.toString(),
        saltHex: toHex(salt, { size: 32 }),
        outerSalt: proxy.outerSalt,
        roleBitmap: roleBitmap.toString(),
        roleBitmapHex: toHex(roleBitmap, { size: 32 }),
        initializeData,
        nextSteps: alreadyDeployed
          ? [
              `Resolver already deployed at ${proxy.address}. No transaction needed.`,
              `Pass it as --resolver ${proxy.address} when running ens register.`,
            ]
          : [
              `1. Broadcast this transaction from ${deployer}`,
              `2. Confirm the resolver is live at ${proxy.address}`,
              `3. Pass it as --resolver ${proxy.address} when running ens register`,
            ],
      }
    },
  })
  .command('set', {
    description:
      'Generate calldata to change the resolver of an existing ENS name. Auto-routes between the v2 registry, the v1 NameWrapper (for wrapped names), and the v1 ENS registry (for unwrapped names).',
    args: z.object({
      name: z.string().describe('ENS name to update (e.g. myname.eth)'),
      resolver: z.string().describe('New resolver address'),
    }),
    options: globalOptions,
    env: globalEnv,
    async run(c) {
      const { client, chain } = clientFromContext(c)
      const name = validateName(c.args.name)
      const resolver = c.args.resolver as `0x${string}`
      const universalResolverAddress = c.options.universalResolver as `0x${string}` | undefined
      const { isV2 } = await isV2Active(c, universalResolverAddress)
      const v2Deployment = isV2 ? v2DeploymentForChain(chain) : undefined

      if (v2Deployment) {
        const labels = name.split('.')
        if (labels.length !== 2 || labels[1] !== 'eth') {
          throw new Error('ENSv2 resolver set currently only supports 2LD .eth names')
        }
        const label = labels[0]!
        const anyId = BigInt(labelhash(label))

        const { status, latestOwner, tokenId } = await client.readContract({
          address: v2Deployment.registry,
          abi: v2RegistryAbi,
          functionName: 'getState',
          args: [anyId],
        })
        if (status !== 2) {
          throw new Error(
            `"${name}" is not registered on the v2 registry (status=${status}). Register it first via ens register.`,
          )
        }

        const data = encodeFunctionData({
          abi: v2RegistryAbi,
          functionName: 'setResolver',
          args: [anyId, resolver],
        })

        return {
          to: v2Deployment.registry,
          data,
          value: '0',
          name,
          label,
          resolver,
          registry: v2Deployment.registry,
          tokenId: tokenId.toString(),
          latestOwner,
          version: 'v2',
          note: 'Transaction must be sent from the name owner or an approved operator.',
        }
      }

      const registryAddress = addresses[chain].registry
      const nameWrapperAddress = addresses[chain].nameWrapper
      const node = namehash(name)

      const registryOwner = await client.readContract({
        address: registryAddress,
        abi: ensRegistryAbi,
        functionName: 'owner',
        args: [node],
      })

      if (registryOwner === ZERO_ADDRESS) {
        throw new Error(
          `"${name}" has no owner in the ENS registry. A resolver cannot be set on an unowned name.`,
        )
      }

      const wrapped = isAddressEqual(registryOwner, nameWrapperAddress)

      if (wrapped) {
        const wrappedOwner = await client.readContract({
          address: nameWrapperAddress,
          abi: nameWrapperAbi,
          functionName: 'ownerOf',
          args: [BigInt(node)],
        })

        const data = encodeFunctionData({
          abi: nameWrapperAbi,
          functionName: 'setResolver',
          args: [node, resolver],
        })

        return {
          to: nameWrapperAddress,
          data,
          value: '0',
          name,
          node,
          resolver,
          owner: wrappedOwner,
          registryOwner,
          wrapped: true,
          version: 'v1',
          note: 'Name is wrapped — call NameWrapper.setResolver. Transaction must be sent from the wrapped owner (or an approved operator).',
        }
      }

      const data = encodeFunctionData({
        abi: ensRegistryAbi,
        functionName: 'setResolver',
        args: [node, resolver],
      })

      return {
        to: registryAddress,
        data,
        value: '0',
        name,
        node,
        resolver,
        owner: registryOwner,
        wrapped: false,
        version: 'v1',
        note: 'Transaction must be sent from the registry owner (or an approved operator).',
      }
    },
  })

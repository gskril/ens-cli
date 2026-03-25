import { test, expect, describe } from 'bun:test'
// @ts-ignore — accessing incur internal WeakMap to get nested command run functions
import { toCommands } from '../../node_modules/incur/dist/Cli.js'
import { registerCommands } from './register.ts'
import { renewCommand } from './renew.ts'
import { reverseCommand } from '../commands/resolve.ts'
import { setCommands } from './set.ts'

// Access nested command run functions from incur Cli instances
const registerCmds = toCommands.get(registerCommands) as Map<string, any>
const setCmds = toCommands.get(setCommands) as Map<string, any>

const commitRun = registerCmds.get('commit')!.run as (c: any) => Promise<any>
const revealRun = registerCmds.get('reveal')!.run as (c: any) => Promise<any>
const setAddressRun = setCmds.get('address')!.run as (c: any) => Promise<any>
const setContenthashRun = setCmds.get('contenthash')!.run as (c: any) => Promise<any>
const setBatchRun = setCmds.get('batch')!.run as (c: any) => Promise<any>

// Minimal mock context that won't trigger RPC — validation should throw first
function mockCtx(overrides: Record<string, any> = {}) {
  return {
    args: { name: 'test.eth', ...overrides.args },
    options: { chain: 'mainnet', ...overrides.options },
    env: { ETH_RPC_URL: 'http://localhost:8545', ...overrides.env },
  }
}

describe('register commit — validation', () => {
  test('invalid owner address throws "Invalid Ethereum address"', () => {
    const ctx = mockCtx({ args: { name: 'test.eth', owner: 'not-an-address' } })
    expect(commitRun(ctx)).rejects.toThrow('Invalid Ethereum address')
  })

  test('invalid resolver address throws "Invalid Ethereum address"', () => {
    const ctx = mockCtx({
      args: { name: 'test.eth', owner: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: { resolver: 'bad-resolver' },
    })
    expect(commitRun(ctx)).rejects.toThrow('Invalid Ethereum address')
  })

  test('invalid secret throws "Invalid bytes32 value"', () => {
    const ctx = mockCtx({
      args: { name: 'test.eth', owner: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: { secret: 'too-short' },
    })
    expect(commitRun(ctx)).rejects.toThrow('Invalid bytes32 value')
  })
})

describe('register reveal — validation', () => {
  test('invalid owner address throws "Invalid Ethereum address"', () => {
    const ctx = mockCtx({
      args: { name: 'test.eth', owner: 'bad-addr' },
      options: {
        chain: 'mainnet',
        secret: '0x' + '00'.repeat(32),
        value: '1000000000000000000',
      },
    })
    expect(revealRun(ctx)).rejects.toThrow('Invalid Ethereum address')
  })

  test('invalid wei value throws "Invalid wei value"', () => {
    const ctx = mockCtx({
      args: {
        name: 'test.eth',
        owner: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      },
      options: {
        chain: 'mainnet',
        secret: '0x' + '00'.repeat(32),
        value: '-100',
      },
    })
    expect(revealRun(ctx)).rejects.toThrow('Invalid wei value')
  })

  test('invalid secret throws "Invalid bytes32 value"', () => {
    const ctx = mockCtx({
      args: {
        name: 'test.eth',
        owner: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      },
      options: {
        chain: 'mainnet',
        secret: 'not-hex',
        value: '1000',
      },
    })
    expect(revealRun(ctx)).rejects.toThrow('Invalid bytes32 value')
  })
})

describe('renew — validation', () => {
  test('invalid wei value throws "Invalid wei value"', () => {
    const ctx = mockCtx({
      args: { name: 'test.eth' },
      options: { chain: 'mainnet', value: '1.5' },
    })
    expect(renewCommand.run(ctx)).rejects.toThrow('Invalid wei value')
  })
})

describe('reverse — validation', () => {
  test('invalid address throws "Invalid Ethereum address"', () => {
    const ctx = mockCtx({ args: { address: 'xyz' } })
    expect(reverseCommand.run(ctx)).rejects.toThrow('Invalid Ethereum address')
  })
})

describe('set address — validation', () => {
  test('invalid address throws "Invalid Ethereum address"', () => {
    const ctx = mockCtx({
      args: { name: 'test.eth', address: 'not-valid' },
    })
    expect(setAddressRun(ctx)).rejects.toThrow('Invalid Ethereum address')
  })

  test('non-EVM coinType accepts hex byte payload instead of Ethereum address', () => {
    // BTC (coinType 0) addresses are hex-encoded byte payloads, not 20-byte ETH addresses
    const ctx = mockCtx({
      args: { name: 'test.eth', address: '0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac' },
      options: { coinType: 0 },
    })
    // Should NOT throw — hex byte payload is valid for non-EVM coin types
    expect(setAddressRun(ctx)).resolves.toBeDefined()
  })

  test('non-EVM coinType rejects invalid hex', () => {
    const ctx = mockCtx({
      args: { name: 'test.eth', address: 'not-hex' },
      options: { coinType: 0 },
    })
    expect(setAddressRun(ctx)).rejects.toThrow('Invalid hex value')
  })
})

describe('set contenthash — validation', () => {
  test('invalid hex hash throws "Invalid hex value"', () => {
    const ctx = mockCtx({
      args: { name: 'test.eth', hash: 'not-hex' },
    })
    expect(setContenthashRun(ctx)).rejects.toThrow('Invalid hex value')
  })
})

describe('set batch — validation', () => {
  test('invalid address in batch JSON throws "Invalid Ethereum address"', () => {
    const ctx = mockCtx({
      args: { name: 'test.eth' },
      options: {
        data: JSON.stringify([
          { type: 'text', key: 'url', value: 'https://ens.domains' },
          { type: 'address', address: 'bad-addr' },
        ]),
      },
    })
    expect(setBatchRun(ctx)).rejects.toThrow('Invalid Ethereum address')
  })

  test('invalid contenthash in batch JSON throws "Invalid hex value"', () => {
    const ctx = mockCtx({
      args: { name: 'test.eth' },
      options: {
        data: JSON.stringify([{ type: 'contenthash', hash: 'not-hex' }]),
      },
    })
    expect(setBatchRun(ctx)).rejects.toThrow('Invalid hex value')
  })

  test('non-EVM coinType in batch accepts hex byte payload', () => {
    const ctx = mockCtx({
      args: { name: 'test.eth' },
      options: {
        data: JSON.stringify([
          { type: 'address', address: '0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac', coinType: 0 },
        ]),
      },
    })
    expect(setBatchRun(ctx)).resolves.toBeDefined()
  })
})

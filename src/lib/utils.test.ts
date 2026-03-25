import { test, expect, describe } from 'bun:test'
import {
  validateAddress,
  validateWeiValue,
  validateBytes32,
  validateHex,
} from './utils.ts'

describe('validateAddress', () => {
  // Valid addresses should be returned as-is with 0x-prefixed type
  test('valid checksummed address returns the address', () => {
    const addr = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
    expect(validateAddress(addr)).toBe(addr)
  })

  test('valid lowercase address returns the address', () => {
    const addr = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
    expect(validateAddress(addr)).toBe(addr)
  })

  test('zero address is valid', () => {
    const addr = '0x0000000000000000000000000000000000000000'
    expect(validateAddress(addr)).toBe(addr)
  })

  // Invalid addresses should throw with descriptive message
  test('invalid checksum throws "Invalid Ethereum address"', () => {
    // Mixed case but NOT valid EIP-55 checksum
    expect(() =>
      validateAddress('0xd8da6BF26964aF9D7eEd9e03E53415D37aA96045'),
    ).toThrow('Invalid Ethereum address')
  })

  test('empty string throws "Invalid Ethereum address"', () => {
    expect(() => validateAddress('')).toThrow('Invalid Ethereum address')
  })

  test('address without 0x prefix throws', () => {
    expect(() =>
      validateAddress('d8dA6BF26964aF9D7eEd9e03E53415D37aA96045'),
    ).toThrow('Invalid Ethereum address')
  })

  test('too short address throws', () => {
    expect(() => validateAddress('0x1234')).toThrow('Invalid Ethereum address')
  })

  test('too long address throws', () => {
    expect(() => validateAddress('0x' + 'a'.repeat(50))).toThrow('Invalid Ethereum address')
  })

  test('non-hex characters throw', () => {
    // 40 G characters — correct length but not valid hex
    expect(() =>
      validateAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG'),
    ).toThrow('Invalid Ethereum address')
  })

  test('random string throws', () => {
    expect(() => validateAddress('not-an-address')).toThrow('Invalid Ethereum address')
  })

  test('whitespace-only string throws', () => {
    expect(() => validateAddress(' ')).toThrow('Invalid Ethereum address')
  })
})

describe('validateWeiValue', () => {
  // Valid values should be returned as strings
  test('valid integer string returns it', () => {
    expect(validateWeiValue('2307947853431408')).toBe('2307947853431408')
  })

  test('zero is a valid wei amount', () => {
    expect(validateWeiValue('0')).toBe('0')
  })

  test('uint256 max value returns it', () => {
    const uint256Max =
      '115792089237316195423570985008687907853269984665640564039457584007913129639935'
    expect(validateWeiValue(uint256Max)).toBe(uint256Max)
  })

  // Invalid values should throw with descriptive message
  test('negative number throws "Invalid wei value"', () => {
    expect(() => validateWeiValue('-1')).toThrow('Invalid wei value')
  })

  test('decimal number throws', () => {
    expect(() => validateWeiValue('1.5')).toThrow('Invalid wei value')
  })

  test('hex string throws', () => {
    expect(() => validateWeiValue('0xff')).toThrow('Invalid wei value')
  })

  test('non-numeric string "abc" throws', () => {
    expect(() => validateWeiValue('abc')).toThrow('Invalid wei value')
  })

  test('non-numeric string "ten" throws', () => {
    expect(() => validateWeiValue('ten')).toThrow('Invalid wei value')
  })

  test('empty string throws', () => {
    expect(() => validateWeiValue('')).toThrow('Invalid wei value')
  })

  test('number with spaces throws', () => {
    expect(() => validateWeiValue(' 123 ')).toThrow('Invalid wei value')
  })

  test('scientific notation throws', () => {
    expect(() => validateWeiValue('1e18')).toThrow('Invalid wei value')
  })
})

describe('validateBytes32', () => {
  test('valid bytes32 hex returns it', () => {
    const hex = '0x' + '00'.repeat(32)
    expect(validateBytes32(hex)).toBe(hex as `0x${string}`)
  })

  test('too short hex throws', () => {
    expect(() => validateBytes32('0x1234')).toThrow('Invalid bytes32 value')
  })

  test('too long hex throws', () => {
    expect(() => validateBytes32('0x' + '00'.repeat(33))).toThrow(
      'Invalid bytes32 value',
    )
  })

  test('non-hex throws', () => {
    expect(() => validateBytes32('0x' + 'G'.repeat(64))).toThrow(
      'Invalid bytes32 value',
    )
  })

  test('missing 0x throws', () => {
    expect(() => validateBytes32('0'.repeat(64))).toThrow(
      'Invalid bytes32 value',
    )
  })
})

describe('validateHex', () => {
  test('valid hex returns it', () => {
    expect(validateHex('0x1234')).toBe('0x1234')
  })

  test('empty hex "0x" returns it', () => {
    expect(validateHex('0x')).toBe('0x')
  })

  test('missing 0x throws', () => {
    expect(() => validateHex('1234')).toThrow('Invalid hex value')
  })

  test('invalid characters throw', () => {
    expect(() => validateHex('0xG123')).toThrow('Invalid hex value')
  })

  test('odd-length hex throws', () => {
    // 0x123 is 3 nibbles = 1.5 bytes — not a valid byte sequence
    expect(() => validateHex('0x123')).toThrow('Invalid hex value')
  })
})

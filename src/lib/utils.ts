import { isAddress, isHex } from 'viem'
import { normalize } from 'viem/ens'

export function validateName(name: string): string {
  if (!name || !name.trim()) {
    throw new Error('Name cannot be empty.')
  }
  const normalized = normalize(name)
  if (!normalized.includes('.')) {
    throw new Error(
      `Invalid ENS name: "${normalized}". Expected a fully qualified name (e.g. name.eth).`,
    )
  }
  return normalized
}

export function extractLabel(name: string): string {
  const normalized = validateName(name)
  const parts = normalized.split('.')
  if (parts.length !== 2 || parts[1] !== 'eth') {
    throw new Error(`Registration only supports 2LDs (e.g. name.eth). Got: ${normalized}`)
  }
  const label = parts[0]!
  if (label.length < 3) {
    throw new Error(
      `Name "${label}.eth" is too short. The registrar requires labels of at least 3 characters.`,
    )
  }
  return label
}

export function validateAddress(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new Error(
      `Invalid Ethereum address: "${address}". Must be a 0x-prefixed address (all-lowercase or EIP-55 checksummed).`,
    )
  }
  return address as `0x${string}`
}

export function validateWeiValue(value: string): string {
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid wei value: "${value}". Must be a non-negative integer (e.g. "2307947853431408"). Run 'ens price <name>' to get the current cost.`,
    )
  }
  return value
}

export function validateBytes32(value: string): `0x${string}` {
  if (!isHex(value) || value.length !== 66) {
    throw new Error(
      `Invalid bytes32 value: "${value}". Must be a 0x-prefixed 32-byte hex string.`,
    )
  }
  return value as `0x${string}`
}

export function validateHex(value: string): `0x${string}` {
  if (!isHex(value, { strict: true }) || (value.length > 2 && value.length % 2 !== 0)) {
    throw new Error(`Invalid hex value: "${value}". Must be a 0x-prefixed hex string with even length.`)
  }
  return value as `0x${string}`
}

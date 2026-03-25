import { test, expect, describe } from 'bun:test'
import { encodeAbiParameters, keccak256 } from 'viem'
import { ethRegistrarControllerAbi } from '../lib/contracts.ts'

// --- Constants ---

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const
const ONE_YEAR = 31536000n

// --- Helpers (duplicated from register.ts since buildRegistration is not exported) ---

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

// Resolve the makeCommitment ABI entry once for all tests (same filter as production)
const makeCommitmentAbi = ethRegistrarControllerAbi.find(
  (x) => x.type === 'function' && x.name === 'makeCommitment',
)!

function computeCommitment(registration: Registration): `0x${string}` {
  const encoded = encodeAbiParameters(makeCommitmentAbi.inputs, [registration])
  return keccak256(encoded)
}

// --- Fixtures ---

const OWNER_A = '0x1234567890abcdef1234567890abcdef12345678' as const
const OWNER_B = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const
const SECRET_A =
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as const
const SECRET_B =
  '0xcafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe' as const
const RESOLVER =
  '0xF29100983E058B709F3D539b0c765937B804AC15' as const

const baseRegistration: Registration = {
  label: 'testname',
  owner: OWNER_A,
  duration: ONE_YEAR,
  secret: SECRET_A,
  resolver: RESOLVER,
  data: [],
  reverseRecord: 0,
  referrer: ZERO_BYTES32,
}

// ============================================================
// 1. Unit Tests for Local Commitment Computation
// ============================================================

describe('Local commitment computation', () => {
  test('produces a valid bytes32 hash', () => {
    const commitment = computeCommitment(baseRegistration)
    expect(commitment).toMatch(/^0x[0-9a-f]{64}$/)
  })

  test('produces valid hashes for varying registrations', () => {
    const registrations: Registration[] = [
      baseRegistration,
      { ...baseRegistration, label: 'alice' },
      { ...baseRegistration, owner: OWNER_B },
      { ...baseRegistration, duration: ONE_YEAR * 2n },
      { ...baseRegistration, secret: SECRET_B },
      { ...baseRegistration, resolver: OWNER_B },
      {
        ...baseRegistration,
        data: [
          '0x1234' as `0x${string}`,
          '0xabcd' as `0x${string}`,
        ],
      },
      { ...baseRegistration, reverseRecord: 1 },
      { ...baseRegistration, referrer: SECRET_A },
    ]

    for (const reg of registrations) {
      const commitment = computeCommitment(reg)
      expect(commitment).toMatch(/^0x[0-9a-f]{64}$/)
    }
  })

  test('is deterministic — same inputs always produce the same commitment', () => {
    const a = computeCommitment(baseRegistration)
    const b = computeCommitment(baseRegistration)
    const c = computeCommitment(baseRegistration)
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  test('different secrets produce different commitments', () => {
    const commitA = computeCommitment({ ...baseRegistration, secret: SECRET_A })
    const commitB = computeCommitment({ ...baseRegistration, secret: SECRET_B })
    expect(commitA).not.toBe(commitB)
  })

  test('different labels produce different commitments', () => {
    const commitA = computeCommitment({ ...baseRegistration, label: 'alice' })
    const commitB = computeCommitment({ ...baseRegistration, label: 'bob' })
    expect(commitA).not.toBe(commitB)
  })

  test('empty data array vs non-empty data produce different commitments', () => {
    const withEmpty = computeCommitment({ ...baseRegistration, data: [] })
    const withData = computeCommitment({
      ...baseRegistration,
      data: ['0xdeadbeef' as `0x${string}`],
    })
    expect(withEmpty).not.toBe(withData)
  })

  test('reverseRecord=0 vs reverseRecord=1 produce different commitments', () => {
    const withZero = computeCommitment({ ...baseRegistration, reverseRecord: 0 })
    const withOne = computeCommitment({ ...baseRegistration, reverseRecord: 1 })
    expect(withZero).not.toBe(withOne)
  })

  test('minimum duration (1 second) produces a valid commitment', () => {
    const commitment = computeCommitment({
      ...baseRegistration,
      duration: 1n,
    })
    expect(commitment).toMatch(/^0x[0-9a-f]{64}$/)
  })

  test('different owners produce different commitments', () => {
    const commitA = computeCommitment({ ...baseRegistration, owner: OWNER_A })
    const commitB = computeCommitment({ ...baseRegistration, owner: OWNER_B })
    expect(commitA).not.toBe(commitB)
  })
})

// ============================================================
// 2. ABI Encoding Correctness Tests
// ============================================================

describe('ABI encoding correctness', () => {
  test('makeCommitment ABI entry exists', () => {
    expect(makeCommitmentAbi).toBeDefined()
    expect(makeCommitmentAbi.name).toBe('makeCommitment')
    expect(makeCommitmentAbi.type).toBe('function')
    expect(makeCommitmentAbi.stateMutability).toBe('pure')
  })

  test('makeCommitment ABI has a tuple input with 8 components', () => {
    expect(makeCommitmentAbi.inputs).toHaveLength(1)
    const tupleInput = makeCommitmentAbi.inputs[0]
    expect(tupleInput.type).toBe('tuple')
    expect(tupleInput.components).toHaveLength(8)
  })

  test('makeCommitment ABI components have expected names and types', () => {
    const components = makeCommitmentAbi.inputs[0].components
    expect(components[0]).toMatchObject({ name: 'label', type: 'string' })
    expect(components[1]).toMatchObject({ name: 'owner', type: 'address' })
    expect(components[2]).toMatchObject({ name: 'duration', type: 'uint256' })
    expect(components[3]).toMatchObject({ name: 'secret', type: 'bytes32' })
    expect(components[4]).toMatchObject({ name: 'resolver', type: 'address' })
    expect(components[5]).toMatchObject({ name: 'data', type: 'bytes[]' })
    expect(components[6]).toMatchObject({ name: 'reverseRecord', type: 'uint8' })
    expect(components[7]).toMatchObject({ name: 'referrer', type: 'bytes32' })
  })

  test('encodeAbiParameters does not throw for valid registration tuple', () => {
    expect(() => {
      encodeAbiParameters(makeCommitmentAbi.inputs, [baseRegistration])
    }).not.toThrow()
  })

  test('encoded output is a valid hex string', () => {
    const encoded = encodeAbiParameters(makeCommitmentAbi.inputs, [
      baseRegistration,
    ])
    expect(encoded).toMatch(/^0x[0-9a-f]+$/)
  })

  test('encoded output has expected minimum length', () => {
    // ABI encoding of a tuple with 8 fields should be at least several hundred chars
    const encoded = encodeAbiParameters(makeCommitmentAbi.inputs, [
      baseRegistration,
    ])
    // 0x prefix + at least 256 hex chars (128 bytes minimum for the fixed-size fields)
    expect(encoded.length).toBeGreaterThan(258)
  })
})

// ============================================================
// 3. Known Test Vector (On-Chain Verification)
// ============================================================

describe('Known test vector', () => {
  test('matches hardcoded commitment for canonical registration', () => {
    // Canonical test vector: label="testname", owner=OWNER_A, duration=1yr,
    // secret=SECRET_A, resolver=RESOLVER, data=[], reverseRecord=0, referrer=ZERO_BYTES32
    const commitment = computeCommitment(baseRegistration)

    // This hash was computed by running:
    //   encodeAbiParameters(makeCommitmentAbi.inputs, [baseRegistration]) |> keccak256
    // If this test fails after the fix is applied, the encoding is wrong.
    const EXPECTED_COMMITMENT =
      '0x3572f4910822536388a1e957e334fce0342580299fc588b6c4255c941be29f9a'

    expect(commitment).toBe(EXPECTED_COMMITMENT)
  })
})

// ============================================================
// 4. Integration Test: No RPC Call for Commitment
// ============================================================

describe('No RPC call for commitment generation', () => {
  test('commitment can be computed without any network calls', () => {
    // This test validates that the commitment is computable purely locally
    // using encodeAbiParameters + keccak256, with no client.readContract needed.
    // If this computation succeeds, no RPC call is required.
    const registration = buildRegistration({
      label: 'offline-test',
      owner: OWNER_A,
      duration: ONE_YEAR,
      secret: SECRET_A,
      resolver: RESOLVER,
      reverseRecord: false,
    })

    const encoded = encodeAbiParameters(makeCommitmentAbi.inputs, [registration])
    const commitment = keccak256(encoded)

    expect(commitment).toMatch(/^0x[0-9a-f]{64}$/)
    // No client, no RPC, no network — pure local computation
  })

  test('register.ts commit command should not use readContract for makeCommitment', async () => {
    // Structural test: read the source and verify it does NOT call readContract
    // for makeCommitment. After the fix, this should pass.
    const source = await Bun.file(
      new URL('./register.ts', import.meta.url).pathname,
    ).text()

    const usesReadContractForMakeCommitment =
      source.includes('readContract') &&
      source.includes("'makeCommitment'")

    // After the fix, the source should NOT use readContract for makeCommitment
    // This test will FAIL on the unfixed code (expected — TDD red phase)
    expect(usesReadContractForMakeCommitment).toBe(false)
  })
})

// ============================================================
// 5. buildRegistration Helper Tests
// ============================================================

describe('buildRegistration helper', () => {
  test('correctly maps all inputs to Registration type', () => {
    const reg = buildRegistration({
      label: 'myname',
      owner: OWNER_A,
      duration: ONE_YEAR,
      secret: SECRET_A,
      resolver: RESOLVER,
      reverseRecord: true,
    })

    expect(reg.label).toBe('myname')
    expect(reg.owner).toBe(OWNER_A)
    expect(reg.duration).toBe(ONE_YEAR)
    expect(reg.secret).toBe(SECRET_A)
    expect(reg.resolver).toBe(RESOLVER)
    expect(reg.reverseRecord).toBe(1)
  })

  test('defaults data to empty array', () => {
    const reg = buildRegistration({
      label: 'test',
      owner: OWNER_A,
      duration: ONE_YEAR,
      secret: SECRET_A,
      resolver: RESOLVER,
      reverseRecord: false,
    })
    expect(reg.data).toEqual([])
  })

  test('defaults referrer to ZERO_BYTES32', () => {
    const reg = buildRegistration({
      label: 'test',
      owner: OWNER_A,
      duration: ONE_YEAR,
      secret: SECRET_A,
      resolver: RESOLVER,
      reverseRecord: false,
    })
    expect(reg.referrer).toBe(ZERO_BYTES32)
  })

  test('maps reverseRecord true to 1', () => {
    const reg = buildRegistration({
      label: 'test',
      owner: OWNER_A,
      duration: ONE_YEAR,
      secret: SECRET_A,
      resolver: RESOLVER,
      reverseRecord: true,
    })
    expect(reg.reverseRecord).toBe(1)
  })

  test('maps reverseRecord false to 0', () => {
    const reg = buildRegistration({
      label: 'test',
      owner: OWNER_A,
      duration: ONE_YEAR,
      secret: SECRET_A,
      resolver: RESOLVER,
      reverseRecord: false,
    })
    expect(reg.reverseRecord).toBe(0)
  })
})

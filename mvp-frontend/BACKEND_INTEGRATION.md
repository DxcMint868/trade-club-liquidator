# Signed Delegation Data Structure

## What Frontend Sends to Backend

When a user joins a match by signing a delegation, the frontend sends this to `POST /api/matches/join`:

```typescript
{
  matchId: "match-123",
  address: "0xUSER_EOA_ADDRESS",
  smartAccountAddress: "0xUSER_SMART_ACCOUNT",
  signedDelegation: {
    delegate: "0xBACKEND_WALLET_ADDRESS",
    delegator: "0xUSER_SMART_ACCOUNT",
    authority: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    caveats: [
      {
        enforcer: "0xLIMITED_CALLS_ENFORCER_ADDRESS",
        terms: "0x0000000000000000000000000000000000000000000000000000000000000064",
        args: "0x"
      }
    ],
    salt: "0x00000000000000000000000000000000000000000000000000000193e0a1d2c0",
    signature: "0xSIGNATURE_FROM_USER_HERE..."
  }
}
```

## Field Explanations

### Top Level
- `matchId`: The match the user is joining
- `address`: User's EOA (externally owned account)
- `smartAccountAddress`: User's MetaMask DeleGator (smart account)
- `signedDelegation`: The delegation object (store as JSON string)

### Signed Delegation Fields
- `delegate`: Who can execute trades (your backend wallet)
- `delegator`: Who is giving permission (user's smart account)
- `authority`: Root authority hash (always `0xffff...`)
- `caveats`: Array of enforcers (on-chain restrictions)
- `salt`: Random nonce (prevents replay attacks)
- `signature`: User's EIP-712 signature

### Caveat (Enforcer) Fields
- `enforcer`: Contract address that enforces rules
- `terms`: Encoded parameters (e.g., "0x64" = 100 in hex)
- `args`: Additional arguments (usually "0x" for simple enforcers)

## How Backend Should Store It

### In Database (Prisma)
```typescript
await prisma.delegation.create({
  data: {
    supporter: request.address.toLowerCase(),
    monachad: matchData.monachad.toLowerCase(),
    matchId: request.matchId,
    isActive: true,
    // Store the entire signedDelegation as JSON string
    signedDelegation: JSON.stringify(request.signedDelegation)
  }
});
```

### When Retrieving
```typescript
const delegation = await prisma.delegation.findFirst({
  where: { supporter, matchId, isActive: true }
});

// Parse it back
const signedDelegation = JSON.parse(delegation.signedDelegation);
```

## How Backend Uses It for Trading

When a Monachad makes a trade, backend:

1. **Retrieve all delegations** for that match:
```typescript
const activeDelegations = await prisma.delegation.findMany({
  where: { 
    monachad: monachadAddress.toLowerCase(),
    matchId,
    isActive: true 
  }
});

const signedDelegations = activeDelegations.map(d => 
  JSON.parse(d.signedDelegation)
);
```

2. **Create batch UserOperations**:
```typescript
import { createExecution, ExecutionMode } from '@metamask/delegation-toolkit';
import { DelegationManager } from '@metamask/delegation-toolkit/dist/contracts';

// For each supporter's delegation
const executions = signedDelegations.map(signedDel => {
  return createExecution({
    target: tradeTarget,  // e.g., Uniswap router
    value: tradeValue,    // ETH amount
    callData: tradeData,  // encoded swap call
  });
});

// Encode batch redemption
const redeemData = DelegationManager.encode.redeemDelegations([
  signedDelegations.map(d => [d]),  // Each delegation in array
  executions
]);
```

3. **Submit to bundler**:
```typescript
const userOpHash = await bundlerClient.sendUserOperation({
  account: delegatorAccount,
  calls: [{
    to: delegationManagerAddress,
    data: redeemData,
    value: 0n
  }]
});
```

## EIP-712 Signature Verification

The signature was created using:

```typescript
// Domain
{
  name: 'DelegationManager',
  version: '1',
  chainId: 84532,  // Base Sepolia
  verifyingContract: DELEGATION_MANAGER_ADDRESS
}

// Types
Delegation: [
  { name: 'delegate', type: 'address' },
  { name: 'delegator', type: 'address' },
  { name: 'authority', type: 'bytes32' },
  { name: 'caveats', type: 'Caveat[]' },
  { name: 'salt', type: 'uint256' }
]

Caveat: [
  { name: 'enforcer', type: 'address' },
  { name: 'terms', type: 'bytes' },
  { name: 'args', type: 'bytes' }
]
```

## Example Full Payload

```json
{
  "matchId": "match-123",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "smartAccountAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "signedDelegation": {
    "delegate": "0xYOUR_BACKEND_WALLET",
    "delegator": "0x1234567890abcdef1234567890abcdef12345678",
    "authority": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "caveats": [
      {
        "enforcer": "0xLIMITED_CALLS_ENFORCER",
        "terms": "0x0000000000000000000000000000000000000000000000000000000000000064",
        "args": "0x"
      }
    ],
    "salt": "0x00000000000000000000000000000000000000000000000000000193e0a1d2c0",
    "signature": "0xabcdef123456789..."
  }
}
```

## Backend Validation Checklist

- [ ] Verify `signedDelegation` is present
- [ ] Verify `delegate` matches your backend wallet
- [ ] Verify `delegator` matches `smartAccountAddress`
- [ ] Verify signature is valid (optional - on-chain will validate)
- [ ] Store as JSON string in database
- [ ] Can parse back to object when needed
- [ ] Can batch multiple delegations in one UserOp

## Contract Addresses Needed

```bash
# Base Sepolia
DELEGATION_MANAGER_ADDRESS=0x... # Get from MetaMask docs
LIMITED_CALLS_ENFORCER=0x...     # Get from MetaMask docs
ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032 # ERC-4337 v0.7
```

## Resources

- MetaMask Delegation Toolkit: https://github.com/MetaMask/delegation-toolkit
- EIP-712: https://eips.ethereum.org/EIPS/eip-712
- ERC-4337: https://eips.ethereum.org/EIPS/eip-4337

---

This data structure is **the core of the entire system**. User signs it, you store it, you redeem it. That's the flow. 🔥

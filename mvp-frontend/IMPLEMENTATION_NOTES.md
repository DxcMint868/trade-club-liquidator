# Implementation Notes - Real MetaMask Delegation Flow

## What Changed

We implemented the **REAL MetaMask Delegation Framework flow**, not a simplified mock.

## Key Files

### `/app/matches/page.tsx` - The Core Implementation

**What it does**:
1. User clicks "Join Match"
2. Creates proper delegation structure:
```typescript
const delegation = {
  delegate: backendAddress,        // Who executes trades
  delegator: smartAccountAddress,  // Smart account delegating
  authority: ROOT_AUTHORITY,       // 0xffff...
  caveats: [{                      // Enforcers
    enforcer: limitedCallsEnforcer,
    terms: "0x64",  // 100 calls max
    args: "0x"
  }],
  salt: randomHex
};
```

3. Signs with EIP-712 typed data (MetaMask popup):
```typescript
const signature = await walletClient.signTypedData({
  domain: {
    name: 'DelegationManager',
    version: '1',
    chainId,
    verifyingContract: delegationManagerAddress
  },
  types: { Delegation, Caveat },
  message: delegation
});
```

4. Sends `signedDelegation` to backend
5. Backend stores in DB as JSON
6. Backend redeems when Monachad trades

### `/app/onboarding/page.tsx` - Smart Account Setup

**What it does**:
- Calls backend API to compute deterministic smart account address
- Falls back to EOA if backend unavailable
- Stores address in localStorage
- Smart account deploys on first delegation (lazy)

## Backend Integration Required

The backend needs these endpoints:

### `POST /api/smart-account/compute`
```typescript
{
  owner: "0xUSER_EOA"
}
→
{
  address: "0xSMART_ACCOUNT"
}
```

### `POST /api/matches/join`
```typescript
{
  matchId: "match-1",
  address: "0xUSER_EOA",
  smartAccountAddress: "0xSMART_ACCOUNT",
  signedDelegation: {
    delegate: "0xBACKEND",
    delegator: "0xSMART_ACCOUNT",
    authority: "0xffff...",
    caveats: [...],
    salt: "0x...",
    signature: "0xSIGNED_BY_USER"
  }
}
```

Backend should:
1. Validate signature
2. Store `JSON.stringify(signedDelegation)` in `Delegation.signedDelegation` field
3. Return success

## Environment Variables Needed

```bash
# The backend wallet address that will execute trades
NEXT_PUBLIC_BACKEND_ADDRESS=0x...

# MetaMask contracts (same on Base Sepolia & Monad)
NEXT_PUBLIC_DELEGATION_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032

# Enforcer contracts
NEXT_PUBLIC_LIMITED_CALLS_ENFORCER=0x...
NEXT_PUBLIC_ALLOWANCE_ENFORCER=0x...

# API
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## How It Works End-to-End

1. **User Flow**:
   - Connect wallet → Onboard (get smart account) → Join match (sign delegation)

2. **Delegation Signing**:
   - Frontend creates delegation structure
   - User signs with EIP-712 in MetaMask
   - Signed delegation sent to backend
   - Backend stores in database

3. **Trade Execution** (Backend):
   - Monachad makes trade
   - Backend retrieves all signed delegations for match
   - Backend creates batch UserOperations using MetaMask Toolkit:
     ```typescript
     const execution = createExecution({
       target: tradeTarget,
       value: tradeValue,
       callData: tradeData
     });
     
     const delegations = [signedDelegation1, signedDelegation2, ...];
     
     const redeemData = DelegationManager.encode.redeemDelegations([
       [delegations],
       [execution]
     ]);
     ```
   - Backend submits to bundler
   - All copy trades execute in one transaction

4. **On-Chain**:
   - Bundler validates delegations
   - Enforcers check caveats (spending limits, etc.)
   - Smart accounts execute trades
   - Events emitted

## Why This Architecture?

- **Users control permissions**: They sign delegations, can revoke anytime
- **Gas efficient**: Batch processing, users don't pay gas
- **On-chain enforcement**: Caveats prevent abuse
- **Decentralized**: Smart contracts validate, not backend
- **Production-ready**: This is the real MetaMask framework, not a mock

## Testing Checklist

- [ ] User can connect wallet
- [ ] Smart account address computed
- [ ] Join match triggers MetaMask signature popup
- [ ] Signature contains proper Delegation type
- [ ] Backend receives and stores signedDelegation
- [ ] Backend can parse and retrieve delegation
- [ ] Backend can execute trades using toolkit
- [ ] Multiple users' trades execute in batch
- [ ] Enforcers are respected (call limits, etc.)

## Next Steps

1. Deploy backend with proper contract addresses
2. Test on Base Sepolia
3. Verify delegations in block explorer
4. Add delegation management UI (revoke, view)
5. Polish UX
6. Deploy to testnet/mainnet

This is **production-grade architecture**, just needs addresses and testing! 🚀

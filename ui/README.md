# TradeClub MVP Frontend

Minimal, functional frontend for testing MetaMask Delegation Toolkit integration with TradeClub backend.

## Purpose

This MVP is for **rapid testing and integration only**. Not production-ready. Designed to:
- Test MetaMask smart account deployment
- Create and sign delegations with enforcers
- Execute batch copy trades using Bob-Alice pattern
- Debug UserOperation flows and delegation redemption

## Tech Stack

- **Next.js 15** (App Router)
- **RainbowKit + Wagmi** (Wallet connection)
- **Viem** (Ethereum library)
- **MetaMask Delegation Toolkit** (Smart accounts & delegation)
- **Tailwind CSS** (Basic styling)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.local.example .env.local
```

3. Configure `.env.local`:
- Get WalletConnect Project ID from https://cloud.walletconnect.com/
- Set `NEXT_PUBLIC_API_URL` to your backend (default: http://localhost:3000)
- Update `NEXT_PUBLIC_DELEGATION_MANAGER_ADDRESS` with Monad deployment

4. Run development server:
```bash
npm run dev
```

Frontend runs on http://localhost:3001

## Pages

### 1. Home (`/`)
Navigation hub with links to all features

### 2. Onboarding (`/onboarding`)
- Connect wallet
- Check/deploy MetaMask smart account (DeleGator)
- View smart account address

### 3. Matches (`/matches`)
- View/join matches (connects to backend API)
- Simple list for testing

### 4. Create Delegation (`/delegation`)
- Set delegation parameters (delegate, spending limit, etc.)
- Configure enforcers (ValueLte, Timestamp, AllowedTargets)
- Sign delegation with connected wallet
- Stores in backend via API

### 5. View Delegations (`/view-delegations`)
- List all signed delegations
- Shows raw delegation data for debugging
- Filter by match/status

### 6. Execute Trade (`/execute-trade`)
- **Bob-Alice pattern implementation**
- Select multiple delegations for batch execution
- Enter trade parameters (target, value, calldata)
- Submit batch UserOperation via bundler
- View execution results

### 7. Monitor (`/monitor`)
- View UserOperation status
- See event logs from blockchain
- Debug execution failures

## Key Implementation Details

### Smart Account Deployment
```typescript
import { toMetaMaskSmartAccount, Implementation } from '@metamask/delegation-toolkit';

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [address as Hex, [], [], []],
  deploySalt: '0x' as Hex,
});
```

### Delegation Creation with Enforcers
```typescript
import { createDelegation } from '@metamask/delegation-toolkit';

const delegation = createDelegation({
  to: monachadAddress,
  from: supporterAddress,
  environment: { /* Monad testnet config */ },
  scope: { type: 'functionCall', /* ... */ },
  caveats: [
    { type: 'ValueLte', args: { maxValue: BigInt(spendingLimit) } },
    { type: 'Timestamp', args: { notBefore, notAfter } },
  ],
});
```

### Batch Execution (Bob-Alice)
```typescript
import { createExecution, ExecutionMode } from '@metamask/delegation-toolkit';
import { DelegationManager } from '@metamask/delegation-toolkit/dist/contracts';

// Prepare batch
const delegations = [/* signed delegations */];
const modes = delegations.map(() => ExecutionMode.SingleDefault);
const executions = delegations.map(d => createExecution({
  target, value, callData
}));

// Encode redemption
const calldata = DelegationManager.encode.redeemDelegations({
  delegations, modes, executions
});

// Submit via bundler
const userOpHash = await bundlerClient.sendUserOperation({
  calls: [{ to: delegationManagerAddress, data: calldata }],
  maxFeePerGas, maxPriorityFeePerGas
});
```

## Reference Documentation

- [MetaMask: Execute on Smart Accounts Behalf](https://docs.metamask.io/delegation-toolkit/guides/delegation/execute-on-smart-accounts-behalf)
- [MetaMask Delegation Toolkit](https://docs.metamask.io/delegation-toolkit/)
- Bob-Alice Example PDF (see repo root)

## API Endpoints (Backend)

Expected backend endpoints:
- `GET /api/matches` - List matches
- `POST /api/matches/join` - Join match
- `GET /api/delegations` - List delegations
- `POST /api/delegations` - Create delegation
- `POST /api/trades/execute` - Trigger copy trade execution

## Development Notes

- All pages use `'use client'` for client-side interactivity
- Wallet state managed by Wagmi hooks
- Public client from Wagmi used for blockchain reads
- Bundler client created on-demand for UserOp submission
- Error handling shows raw messages for debugging
- JSON pretty-print for all responses

## Limitations

- No input validation (this is a test UI)
- Minimal error handling
- No retry logic
- Hard-coded gas prices
- No transaction history
- Basic styling only

## Next Steps for Production Frontend

When building the real frontend:
- Proper form validation
- Better error messages
- Transaction history
- Real-time WebSocket updates
- Proper state management (Zustand/Redux)
- Loading states everywhere
- Mobile responsive design
- Comprehensive testing

---

**This is a testing tool, not a production app. Use at your own risk.**

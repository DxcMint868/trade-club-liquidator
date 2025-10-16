# 🚀 TradeClub Contracts - Quick Start Guide

## Hackathon Fast Track ⚡

### Step 1: Install Dependencies (1 min)
```bash
cd contracts
npm install
```

### Step 2: Compile Contracts (30 sec)
```bash
npm run compile
```
✅ Generates TypeScript types in `typechain-types/`

### Step 3: Run Tests (1 min)
```bash
npm test
```
✅ All 17 tests should pass

### Step 4: Deploy to Local Network (1 min)
```bash
# Terminal 1: Start local Hardhat node
npx hardhat node

# Terminal 2: Deploy contracts
npm run deploy:local
```

### Step 5: Deploy to Monad Testnet (2 min)
```bash
# 1. Create .env file
cp .env.example .env

# 2. Add your private key to .env
PRIVATE_KEY=your_private_key_here
MONAD_RPC_URL=https://testnet-rpc.monad.xyz

# 3. Deploy
npm run deploy:monad-testnet
```

## 📋 Contract Addresses (After Deployment)

After deployment, addresses will be saved to `deployments/` folder:

```json
{
  "TradeClubToken": "0x...",
  "MatchManager": "0x...",
  "DelegationRegistry": "0x...",
  "BribePool": "0x..."
}
```

## 🔗 Integration with Backend

### Import Contract ABIs
```typescript
// In your backend (NestJS)
import MatchManagerABI from '@tradeclub/contracts/artifacts/src/MatchManager.sol/MatchManager.json'
import DelegationRegistryABI from '@tradeclub/contracts/artifacts/src/DelegationRegistry.sol/DelegationRegistry.json'

const matchManager = new ethers.Contract(
  MATCH_MANAGER_ADDRESS,
  MatchManagerABI.abi,
  provider
)
```

### Import TypeScript Types
```typescript
// Type-safe contract interactions
import { MatchManager, DelegationRegistry } from '@tradeclub/contracts/typechain-types'

const matchManager = MatchManager__factory.connect(address, signer)
const match = await matchManager.getMatch(matchId) // Fully typed!
```

## 📡 Key Contract Interactions

### Create a Match
```typescript
const tx = await matchManager.createMatch(
  ethers.parseEther("0.1"), // entry margin
  3600, // duration (1 hour)
  5, // max participants
  { value: ethers.parseEther("0.1") }
)
await tx.wait()
```

### Join a Match
```typescript
const tx = await matchManager.joinMatch(
  matchId,
  { value: ethers.parseEther("0.1") }
)
```

### Create Delegation
```typescript
const caveats = {
  allowedContracts: [DEX_ADDRESS],
  maxSlippage: 100, // 1%
  maxTradeSize: ethers.parseEther("0.5")
}

const tx = await delegationRegistry.createDelegation(
  monachadAddress,
  matchId,
  ethers.parseEther("1.0"), // delegation amount
  ethers.parseEther("2.0"), // spending limit
  3600, // duration
  caveats,
  { value: ethers.parseEther("1.0") }
)
```

### Listen to Events (for Envio/Backend)
```typescript
// Match created event
matchManager.on("MatchCreated", (matchId, creator, entryMargin, duration, maxParticipants) => {
  console.log(`New match ${matchId} created by ${creator}`)
  // Index this match in your database
})

// Delegation created event
delegationRegistry.on("DelegationCreated", (delegationHash, supporter, monachad, matchId) => {
  console.log(`New delegation ${delegationHash} from ${supporter} to ${monachad}`)
  // Start copying trades for this delegation
})
```

## 🎯 Hackathon Focus Areas

### High Priority
1. ✅ **Smart Contracts** - DONE! All contracts deployed and tested
2. 🚧 **Backend Integration** - Connect contracts to NestJS
3. 🚧 **Frontend UI** - MetaMask Smart Account integration
4. 🚧 **Envio Indexer** - Real-time event processing

### Contract-Backend Integration Checklist
- [ ] Connect to deployed contracts via ethers.js
- [ ] Set up event listeners for real-time updates
- [ ] Implement match management API
- [ ] Build delegation tracking system
- [ ] Create trade copying engine
- [ ] Set up WebSocket for live updates

### Frontend Integration Checklist
- [ ] Import contract ABIs and types
- [ ] Set up MetaMask Smart Account provider
- [ ] Build match creation form
- [ ] Build delegation management UI
- [ ] Display real-time leaderboards
- [ ] Show trade execution feed

## 🔧 Useful Commands

### Development
```bash
npm run compile      # Compile contracts
npm test            # Run test suite
npm run test:coverage # Test coverage report
npm run test:gas    # Gas usage report
npm run clean       # Clean artifacts
```

### Deployment
```bash
npm run deploy:local          # Local Hardhat network
npm run deploy:monad-testnet  # Monad testnet
npm run deploy:monad          # Monad mainnet
```

### Code Quality
```bash
npm run lint        # Lint Solidity files
npm run format      # Format all files
```

## 📚 Contract Documentation

### MatchManager
- **Purpose:** Manages competitive trading matches
- **Key Functions:** `createMatch()`, `joinMatch()`, `settleMatch()`, `updatePnL()`
- **Events:** `MatchCreated`, `ParticipantJoined`, `MatchStarted`, `MatchCompleted`

### DelegationRegistry
- **Purpose:** Non-custodial trading delegations
- **Key Functions:** `createDelegation()`, `revokeDelegation()`, `executeDelegatedTrade()`
- **Events:** `DelegationCreated`, `DelegationRevoked`, `DelegationExecuted`

### TradeClubToken
- **Purpose:** Governance token with voting
- **Key Functions:** `mint()`, `delegate()`, `getVotes()`
- **Standard:** ERC20 + ERC20Votes + ERC20Permit

### BribePool
- **Purpose:** Governance bribe wars
- **Key Functions:** `createBribe()`, `delegateVotes()`, `claimReward()`
- **Events:** `BribeCreated`, `VotesDelegated`, `RewardClaimed`

## 🐛 Troubleshooting

### Compilation Errors
```bash
# Clean and recompile
npm run clean
npm run compile
```

### Test Failures
```bash
# Run tests with stack traces
npx hardhat test --show-stack-traces
```

### Deployment Issues
```bash
# Check account balance
npx hardhat run scripts/check-balance.ts --network monadTestnet

# Verify network connectivity
curl -X POST https://testnet-rpc.monad.xyz \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## 💡 Pro Tips

1. **Use TypeScript types** - Import from `typechain-types/` for type safety
2. **Monitor events** - All important actions emit events for indexing
3. **Test locally first** - Use Hardhat network before deploying to testnet
4. **Save deployment info** - Check `deployments/` folder after each deploy
5. **Gas optimization** - Contracts are already optimized with 200 runs

## 🎬 Demo Script for Hackathon

### 1. Create Match (Monachad)
```typescript
const match = await matchManager.createMatch(...)
console.log("Match created:", match.id)
```

### 2. Supporter Delegates
```typescript
const delegation = await delegationRegistry.createDelegation(...)
console.log("Delegation active:", delegation.hash)
```

### 3. Monachad Trades
```typescript
// Monachad executes trade
const trade = await dex.swap(...)
// Backend detects and copies trade for supporters
```

### 4. Match Settles
```typescript
await matchManager.settleMatch(matchId)
console.log("Winner:", match.winner)
```

## 🏆 Success Criteria

- ✅ All contracts compile without errors
- ✅ All tests pass (17/17)
- ✅ Deployments successful on target networks
- ✅ Contract ABIs available for integration
- ✅ TypeScript types generated
- ✅ Documentation complete

**Status: READY TO BUILD! 🚀**

---

*Built for MetaMask x Monad Hackathon*  
*Team TradeClub - October 2025*

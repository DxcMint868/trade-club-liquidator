# TradeClub Smart Contracts

Smart contracts for the TradeClub competitive trading platform built on Monad blockchain with MetaMask Smart Accounts delegation.

## Overview

TradeClub enables competitive trading matches where skilled traders (Monachads) compete head-to-head while supporters can delegate trading authority to follow their strategies in real-time without transferring custody.

## Contracts

### Core Contracts

- **MatchManager.sol** - Manages competitive trading matches, participant registration, and prize distribution
- **DelegationRegistry.sol** - Handles non-custodial trading delegations with time-bound permissions
- **TradeClubToken.sol** - TCLUB governance token with voting capabilities
- **BribePool.sol** - Manages governance bribe wars for DAO participation

### Interfaces

- **IMatchManager.sol** - Match management interface
- **IDelegationRegistry.sol** - Delegation registry interface
- **ITradeClubToken.sol** - Token interface with voting

## Architecture

```
┌─────────────────────┐
│   MatchManager      │  Creates & manages trading competitions
└─────────┬───────────┘
          │
          ├──────────────┐
          │              │
┌─────────▼───────────┐ ┌▼─────────────────────┐
│ DelegationRegistry  │ │   TradeClubToken     │
│ (Copy Trading)      │ │   (Governance)       │
└─────────────────────┘ └───────┬──────────────┘
                                │
                        ┌───────▼──────────┐
                        │    BribePool     │
                        │  (Bribe Wars)    │
                        └──────────────────┘
```

## Setup

### Install Dependencies

```bash
npm install
```

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm test
```

### Deploy Contracts

```bash
# Local Hardhat network
npx hardhat run scripts/deploy.ts

# Monad testnet
npx hardhat run scripts/deploy.ts --network monad-testnet

# Monad mainnet
npx hardhat run scripts/deploy.ts --network monad-mainnet
```

## Configuration

Update `hardhat.config.ts` with your network settings:

```typescript
networks: {
  monad: {
    url: process.env.MONAD_RPC_URL || "",
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
  }
}
```

## Environment Variables

Create a `.env` file:

```env
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Features

### Match Creation & Management
- Time-limited competitive trading matches
- Configurable entry margins and prize pools
- Automated match settlement and winner determination
- Real-time PnL tracking

### Non-Custodial Delegation
- Supporters delegate trading permissions without custody transfer
- Granular permission controls (contracts, spending limits, duration)
- Automatic expiry and manual revocation
- Proportional trade copying

### DAO Governance
- TCLUB token-based voting
- Quadratic voting to prevent whale dominance
- Vote delegation without token transfer
- Transparent on-chain governance

### Bribe Wars
- Monachads create bribe pools to influence governance
- Community delegates voting power for rewards
- Quadratic scaling prevents manipulation
- Transparent bribe marketplace

## Security

- Non-custodial architecture - users maintain full asset control
- ReentrancyGuard on all state-changing functions
- Pausable emergency controls
- Time-bound delegations with automatic expiry
- Spending limits and contract whitelisting

## Testing

Comprehensive test coverage includes:

- Match creation and participation flows
- Delegation creation and revocation
- Trade execution through delegations
- Governance voting and bribe mechanics
- Edge cases and error conditions

Run tests:
```bash
npm test

# With coverage
npx hardhat coverage

# Gas report
REPORT_GAS=true npm test
```

## License

MIT

## Hackathon

Built for the MetaMask Smart Accounts x Monad Hackathon

**Key Technologies:**
- Monad blockchain for high-performance execution
- MetaMask Smart Accounts for advanced delegation
- Hardhat + Foundry for development
- OpenZeppelin for security best practices

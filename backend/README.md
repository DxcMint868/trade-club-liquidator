# TradeClub Backend

NestJS backend for the TradeClub competitive social copy trading platform.

## 🏗️ Architecture

### Core Modules

1. **DatabaseModule** - Prisma ORM integration for PostgreSQL
2. **BlockchainModule** - Web3 contract interactions and event listeners
3. **MatchesModule** - Competitive trading match management
4. **DelegationModule** - Non-custodial delegation tracking
5. **TradingModule** - Copy trading engine with proportional execution
6. **GovernanceModule** - DAO proposals and bribe wars

### Tech Stack

- **Framework**: NestJS 10.x
- **Database**: PostgreSQL with Prisma ORM
- **Web3**: ethers.js v6 for Monad blockchain
- **Real-time**: Socket.io WebSocket gateway
- **Event System**: @nestjs/event-emitter for blockchain event handling

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Deployed smart contracts on Monad

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Set up database
npx prisma migrate dev
```

### Environment Variables

Create a `.env` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/tradeclub?schema=public"

# Blockchain
MONAD_RPC_URL="https://testnet.monad.xyz"
PRIVATE_KEY="your_private_key_here"

# Contract Addresses (deploy contracts first)
MATCH_MANAGER_ADDRESS="0x..."
DELEGATION_REGISTRY_ADDRESS="0x..."
GOVERNANCE_TOKEN_ADDRESS="0x..."
BRIBE_POOL_ADDRESS="0x..."

# Server
PORT=3001
```

### Running the App

```bash
# Development mode with hot-reload
npm run start:dev

# Production build
npm run build
npm run start:prod

# Watch mode
npm run start:debug
```

## 📊 Database Schema

### Models

- **Match** - Trading competition matches
- **Participant** - Match participants with PnL tracking
- **Delegation** - Non-custodial delegations with spending limits
- **Trade** - Trade execution records (Monachad trades + supporter copies)
- **Governance** - DAO governance proposals
- **Bribe** - Governance bribe wars
- **Vote** - Voting records for bribes

### Migrations

```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database (development only!)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

## 🔌 API Endpoints

### Matches

```
GET    /matches                       - Get all matches
GET    /matches/active                - Get active matches
GET    /matches/:matchId              - Get match details
GET    /matches/:matchId/participants - Get match participants
GET    /matches/:matchId/leaderboard  - Get match leaderboard
GET    /matches/user/:address         - Get user's matches
POST   /matches/:matchId/update-pnl   - Update participant PnL
```

### Delegations

```
GET    /delegations/:delegationHash           - Get delegation details
GET    /delegations/:delegationHash/valid     - Check if delegation is valid
GET    /delegations/user/:address             - Get user's delegations
GET    /delegations/user/:address/stats       - Get delegation statistics
GET    /delegations/monachad/:address         - Get active delegations for Monachad
GET    /delegations/monachad/:address/supporters - Get Monachad supporters
GET    /delegations/match/:matchId            - Get delegations by match
```

### Trading

```
GET    /trading/match/:matchId/trades         - Get trades by match
GET    /trading/trader/:address/trades        - Get trades by trader
GET    /trading/match/:matchId/trader/:address/history - Get trade history
GET    /trading/trader/:address/stats         - Get trading statistics
GET    /trading/monachad/:address/copy-stats  - Get copy trading stats
GET    /trading/supporter/:address/performance - Get supporter performance
POST   /trading/copy-trades/execute           - Execute copy trades
```

### Governance

```
GET    /governance/proposals                  - Get all proposals
GET    /governance/proposals/active           - Get active proposals
GET    /governance/proposals/:proposalId      - Get proposal details
GET    /governance/proposals/:proposalId/bribes - Get bribes for proposal
GET    /governance/bribes/:bribeId            - Get bribe details
GET    /governance/bribes/:bribeId/votes      - Get votes for bribe
GET    /governance/bribes/:bribeId/leaderboard - Get bribe leaderboard
GET    /governance/bribes/:bribeId/stats      - Get bribe statistics
GET    /governance/user/:address/votes        - Get user votes
GET    /governance/user/:address/activity     - Get user governance activity
```

### Health

```
GET    /health                                - Health check endpoint
```

## 🔄 WebSocket Events

### Client → Server
None (read-only WebSocket, API handles writes)

### Server → Client

**Match Events:**
- `match:created` - New match created
- `match:participant-joined` - Participant joined match
- `match:started` - Match started
- `match:completed` - Match completed
- `match:pnl-updated` - Participant PnL updated
- `match:leaderboard-update` - Leaderboard updated
- `match:trade-executed` - Trade executed notification

**Delegation Events:**
- `delegation:created` - New delegation created
- `delegation:revoked` - Delegation revoked
- `delegation:executed` - Delegated trade executed
- `delegation:update` - Delegation updated

**Governance Events:**
- `governance:bribe-created` - New bribe created
- `governance:votes-delegated` - Votes delegated

## 🎯 Blockchain Event Listeners

The backend automatically listens to smart contract events:

### MatchManager Events
- `MatchCreated` → Updates database, broadcasts to clients
- `ParticipantJoined` → Adds participant, broadcasts
- `MatchStarted` → Updates match status, broadcasts
- `MatchCompleted` → Records winner, broadcasts
- `PnLUpdated` → Updates participant PnL, broadcasts

### DelegationRegistry Events
- `DelegationCreated` → Saves delegation, broadcasts
- `DelegationRevoked` → Marks inactive, broadcasts
- `DelegationExecuted` → Updates spent amount, broadcasts

### BribePool Events
- `BribeCreated` → Saves bribe, broadcasts
- `VotesDelegated` → Records vote, broadcasts

## 🔐 Security Considerations

1. **Private Key Management**: Store private keys securely, use environment variables
2. **Database Credentials**: Use strong passwords, restrict access
3. **CORS**: Configure allowed origins in production
4. **Rate Limiting**: Add rate limiting middleware for production
5. **Input Validation**: All DTOs use class-validator
6. **SQL Injection**: Protected by Prisma ORM
7. **Address Normalization**: All addresses lowercased for consistency

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📈 Performance

### Database Indexes

Prisma schema includes indexes on:
- `Match.matchId` (unique)
- `Match.creator`
- `Match.status`
- `Participant.matchId` + `address` (composite unique)
- `Delegation.delegationHash` (unique)
- `Delegation.supporter`
- `Delegation.monachad`

### Optimization Tips

1. **Connection Pooling**: Prisma handles connection pooling automatically
2. **Query Optimization**: Use `include` for eager loading related data
3. **Caching**: Consider Redis for frequently accessed data
4. **Batch Operations**: Use Prisma's batch operations for bulk inserts
5. **Event Listeners**: Processes blockchain events asynchronously

## 🔧 Development

### Project Structure

```
backend/
├── src/
│   ├── blockchain/        # Contract service & event listeners
│   ├── database/          # Prisma service
│   ├── delegation/        # Delegation management
│   ├── governance/        # DAO & bribe wars
│   ├── matches/           # Match management
│   ├── trading/           # Trading & copy engine
│   ├── app.module.ts      # Root module
│   ├── main.ts            # Bootstrap
│   └── health.controller.ts
├── prisma/
│   └── schema.prisma      # Database schema
├── package.json
└── tsconfig.json
```

### Adding New Features

1. Create module: `nest g module feature`
2. Create service: `nest g service feature`
3. Create controller: `nest g controller feature`
4. Add to `app.module.ts` imports
5. Update Prisma schema if needed
6. Run migrations: `npx prisma migrate dev`

## 🐛 Debugging

### Enable Debug Logging

```typescript
// main.ts
app.useLogger(['error', 'warn', 'log', 'debug', 'verbose']);
```

### Prisma Query Logging

```typescript
// database.service.ts
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

### WebSocket Debugging

Connect to WebSocket at `ws://localhost:3001` using a client like:

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3001');

socket.on('match:created', (data) => {
  console.log('Match created:', data);
});
```

## 📦 Dependencies

### Core
- `@nestjs/common` - NestJS core
- `@nestjs/core` - NestJS core
- `@nestjs/platform-express` - Express adapter
- `@nestjs/config` - Configuration module
- `@nestjs/event-emitter` - Event system
- `@nestjs/schedule` - Task scheduling
- `@nestjs/websockets` - WebSocket support
- `@prisma/client` - Prisma ORM
- `prisma` - Prisma CLI

### Web3
- `ethers` - Ethereum library

### WebSocket
- `socket.io` - WebSocket library
- `@nestjs/platform-socket.io` - Socket.io adapter

### Utilities
- `class-validator` - DTO validation
- `class-transformer` - Object transformation

## 🚢 Deployment

### Docker (Recommended)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3001
CMD ["npm", "run", "start:prod"]
```

### Environment-Specific Configs

- Development: `.env.development`
- Staging: `.env.staging`
- Production: `.env.production`

### Health Checks

The `/health` endpoint returns service status for monitoring.

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

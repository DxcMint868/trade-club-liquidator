#!/bin/bash

# TradeClub Backend Setup Script

echo "🚀 TradeClub Backend Setup"
echo "=========================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration before continuing."
    echo ""
    echo "Required values:"
    echo "  - DATABASE_URL (PostgreSQL connection string)"
    echo "  - MONAD_RPC_URL (Monad testnet RPC)"
    echo "  - PRIVATE_KEY (your wallet private key)"
    echo "  - Contract addresses (from deployment)"
    echo ""
    exit 1
fi

echo "✅ .env file found"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Generate Prisma Client
echo "🔄 Generating Prisma Client..."
npx prisma generate
echo ""

# Check if database is accessible
echo "🔍 Checking database connection..."
if npx prisma db execute --stdin <<< "SELECT 1;" 2>/dev/null; then
    echo "✅ Database connected"
    echo ""
    
    # Ask about migrations
    read -p "🔄 Run database migrations? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Running migrations..."
        npx prisma migrate deploy
        echo ""
    fi
else
    echo "⚠️  Could not connect to database"
    echo "   Please check your DATABASE_URL in .env"
    echo ""
    read -p "🔄 Create database and run migrations? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Creating database and running migrations..."
        npx prisma migrate dev
        echo ""
    fi
fi

# Check contract addresses
echo "🔍 Checking contract configuration..."
if grep -q "0x\.\.\." .env; then
    echo "⚠️  Contract addresses not configured in .env"
    echo "   Please deploy contracts first and update .env with addresses:"
    echo "   - MATCH_MANAGER_ADDRESS"
    echo "   - DELEGATION_REGISTRY_ADDRESS"
    echo "   - GOVERNANCE_TOKEN_ADDRESS"
    echo "   - BRIBE_POOL_ADDRESS"
    echo ""
    echo "📝 Deploy contracts with:"
    echo "   cd ../contracts && npx hardhat run scripts/deploy.ts --network monad_testnet"
    echo ""
else
    echo "✅ Contract addresses configured"
    echo ""
fi

# Final status
echo "=========================="
echo "✅ Setup complete!"
echo ""
echo "🚀 Start the backend:"
echo "   npm run start:dev"
echo ""
echo "📊 Open Prisma Studio:"
echo "   npx prisma studio"
echo ""
echo "🏥 Health check:"
echo "   curl http://localhost:3001/health"
echo ""
echo "🔌 WebSocket test:"
echo "   wscat -c ws://localhost:3001"
echo ""

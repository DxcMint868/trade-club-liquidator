import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Price Oracle Script for FUNDex
 * Simulates realistic price movements for demo/hackathon
 */

const FUNDEX_ADDRESS = process.env.FUNDEX_ADDRESS || "";
const UPDATE_INTERVAL_MS = 5000; // Update every 5 seconds
const VOLATILITY = 0.02; // 2% max change per update

interface AssetConfig {
  id: number;
  symbol: string;
  basePrice: number;
  volatility: number;
}

// Configure assets to simulate
const ASSETS: AssetConfig[] = [
  { id: 1, symbol: "ETH/USD", basePrice: 2000, volatility: VOLATILITY },
  // Add more assets as needed
];

class PriceOracle {
  private fundex: any;
  private currentPrices: Map<number, number> = new Map();
  private isRunning = false;

  constructor(fundexContract: any) {
    this.fundex = fundexContract;
    
    // Initialize current prices
    for (const asset of ASSETS) {
      this.currentPrices.set(asset.id, asset.basePrice);
    }
  }

  /**
   * Generate next price using random walk
   */
  private getNextPrice(assetId: number): number {
    const currentPrice = this.currentPrices.get(assetId) || ASSETS.find(a => a.id === assetId)!.basePrice;
    const config = ASSETS.find(a => a.id === assetId)!;
    
    // Random walk: price can go up or down by up to volatility%
    const changePercent = (Math.random() - 0.5) * 2 * config.volatility;
    const newPrice = currentPrice * (1 + changePercent);
    
    this.currentPrices.set(assetId, newPrice);
    return newPrice;
  }

  /**
   * Update prices on-chain
   */
  private async updatePrices() {
    try {
      const assetIds: number[] = [];
      const newPrices: bigint[] = [];
      
      for (const asset of ASSETS) {
        const nextPrice = this.getNextPrice(asset.id);
        const priceScaled = BigInt(Math.floor(nextPrice * 1e18));
        
        assetIds.push(asset.id);
        newPrices.push(priceScaled);
        
        console.log(`${asset.symbol}: $${nextPrice.toFixed(2)}`);
      }
      
      // Batch update prices
      const tx = await this.fundex.batchUpdatePrices(assetIds, newPrices);
      await tx.wait();
      
      console.log(`Price update tx: ${tx.hash}\n`);
    } catch (error: any) {
      console.error("Error updating prices:", error.message);
    }
  }

  /**
   * Start the oracle (continuous updates)
   */
  async start() {
    console.log("Starting FUNDex Price Oracle...");
    console.log(`FUNDex Address: ${await this.fundex.getAddress()}`);
    console.log(`Update Interval: ${UPDATE_INTERVAL_MS}ms`);
    console.log(`Volatility: ${VOLATILITY * 100}%\n`);
    
    this.isRunning = true;
    
    while (this.isRunning) {
      await this.updatePrices();
      await new Promise(resolve => setTimeout(resolve, UPDATE_INTERVAL_MS));
    }
  }

  /**
   * Stop the oracle
   */
  stop() {
    this.isRunning = false;
    console.log("Oracle stopped");
  }

  /**
   * One-time price update (for manual testing)
   */
  async updateOnce() {
    console.log("Updating prices once...\n");
    await this.updatePrices();
  }

  /**
   * Create chaos mode: rapid volatile price swings
   */
  async chaosMode(durationSeconds: number) {
    console.log(`CHAOS MODE ACTIVATED for ${durationSeconds}s!\n`);
    
    const originalVolatility = VOLATILITY;
    const chaosVolatility = 0.05; // 5% swings
    
    // Increase volatility
    for (const asset of ASSETS) {
      asset.volatility = chaosVolatility;
    }
    
    const endTime = Date.now() + (durationSeconds * 1000);
    
    while (Date.now() < endTime) {
      await this.updatePrices();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Faster updates
    }
    
    // Restore normal volatility
    for (const asset of ASSETS) {
      asset.volatility = originalVolatility;
    }
    
    console.log("Chaos mode ended\n");
  }
}

async function main() {
  if (!FUNDEX_ADDRESS) {
    throw new Error("FUNDEX_ADDRESS not set in .env");
  }

  const [signer] = await ethers.getSigners();
  console.log("Oracle operator:", signer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "ETH\n");

  const fundex = await ethers.getContractAt("FUNDex", FUNDEX_ADDRESS);
  const oracle = new PriceOracle(fundex);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0] || "start";

  switch (command) {
    case "start":
      // Continuous updates
      await oracle.start();
      break;
      
    case "once":
      // Single update
      await oracle.updateOnce();
      break;
      
    case "chaos":
      // Chaos mode for specified duration (default 60s)
      const duration = parseInt(args[1]) || 60;
      await oracle.chaosMode(duration);
      break;
      
    default:
      console.log("Usage:");
      console.log("  npm run oracle:start     - Start continuous price updates");
      console.log("  npm run oracle:once      - Update prices once");
      console.log("  npm run oracle:chaos [duration] - Chaos mode (default 60s)");
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log("\nShutting down oracle...");
  process.exit(0);
});

main()
  .then(() => {
    if (process.argv[2] !== "start") {
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

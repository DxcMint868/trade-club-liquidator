import { ethers } from "hardhat";

async function main() {
  console.log("Starting TradeClub deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 1. Deploy TradeClubToken
  console.log("\n1. Deploying TradeClubToken...");
  const TradeClubToken = await ethers.getContractFactory("TradeClubToken");
  const tclubToken = await TradeClubToken.deploy();
  await tclubToken.waitForDeployment();
  const tclubTokenAddress = await tclubToken.getAddress();
  console.log("TradeClubToken deployed to:", tclubTokenAddress);

  // 2. Deploy MatchManager
  console.log("\n2. Deploying MatchManager...");
  const MatchManager = await ethers.getContractFactory("MatchManager");
  const matchManager = await MatchManager.deploy();
  await matchManager.waitForDeployment();
  const matchManagerAddress = await matchManager.getAddress();
  console.log("MatchManager deployed to:", matchManagerAddress);

  // 3. Deploy DelegationRegistry
  console.log("\n3. Deploying DelegationRegistry...");
  const DelegationRegistry = await ethers.getContractFactory("DelegationRegistry");
  const delegationRegistry = await DelegationRegistry.deploy(matchManagerAddress);
  await delegationRegistry.waitForDeployment();
  const delegationRegistryAddress = await delegationRegistry.getAddress();
  console.log("DelegationRegistry deployed to:", delegationRegistryAddress);

  // 4. Deploy BribePool
  console.log("\n4. Deploying BribePool...");
  const BribePool = await ethers.getContractFactory("BribePool");
  const bribePool = await BribePool.deploy(tclubTokenAddress);
  await bribePool.waitForDeployment();
  const bribePoolAddress = await bribePool.getAddress();
  console.log("BribePool deployed to:", bribePoolAddress);

  // Setup: Add BribePool as minter for rewards
  console.log("\n5. Setting up token minters...");
  const addMinterTx = await tclubToken.addMinter(bribePoolAddress);
  await addMinterTx.wait();
  console.log("BribePool added as TCLUB token minter");

  // Print deployment summary
  console.log("\n=== Deployment Summary ===");
  console.log("TradeClubToken:", tclubTokenAddress);
  console.log("MatchManager:", matchManagerAddress);
  console.log("DelegationRegistry:", delegationRegistryAddress);
  console.log("BribePool:", bribePoolAddress);
  console.log("Deployer:", deployer.address);

  // Save deployment addresses to file
  const fs = require("fs");
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      TradeClubToken: tclubTokenAddress,
      MatchManager: matchManagerAddress,
      DelegationRegistry: delegationRegistryAddress,
      BribePool: bribePoolAddress,
    },
  };

  fs.writeFileSync(
    `./deployments/${Date.now()}-deployment.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment info saved to ./deployments/");
  console.log("\n✅ Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

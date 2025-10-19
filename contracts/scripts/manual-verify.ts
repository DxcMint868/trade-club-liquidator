import hre from "hardhat";

async function main() {
  // const readData = fs.readFileSync(`./deployed/pump.json`, 'utf8');

  // const data = JSON.parse(readData)
  // console.log(data);
  console.log("-----------------------------------------------------------------------\n");
  await hre.run("verify:verify", {
    // StepVesting
    // contract: "contracts/SecondSwap_StepVesting.sol:SecondSwap_StepVesting",
    // address: "0x3030914465aE2ea2089982b06f309dCbC7494583", // on-chain address

    // VestingDeployer
    // contract: "contracts/SecondSwap_VestingDeployer.sol:SecondSwap_VestingDeployer",
    // address: "0x1106F572d6e95ef053035507Eb6FC0e1666C0d7d",

    // MatchVault
    contract: "src/TradeClub_MatchVault.sol:TradeClub_MatchVault",
    address: "0xda00cd152db6e65dbbf95841916ee14b82f843d7",

    // Vesting Manager
    // contract: "contracts/SecondSwap_VestingManager.sol:SecondSwap_VestingManager",
    // address: "0x77b6D9C8e43907d339d290dE2DA301Edd54e815D",
    // address: "0xFEA09bFDCFb68CBeC4c8f18BD0edd25B961b6868",

    // // Marketplace
    // contract: "contracts/SecondSwap_Marketplace.sol:SecondSwap_Marketplace",
    // address: "0x65bFb03b8bB47455A51cb48E00f74adA6d534C5f",

    // Whitelist Deployer
    // contract: "contracts/SecondSwap_WhitelistDeployer.sol:SecondSwap_WhitelistDeployer",
    // address: "0x3e3ecd56e26561f56E383603A24975771f8DC274",

    // Whitelist Contract
    // contract: "contracts/SecondSwap_Whitelist.sol:SecondSwap_Whitelist",
    // address: "0x3f9Fe24E2dA5193f9A2aD2F5bf1E5473Da53c32A",

    // ProxyAdmin Contract
    // contract: "contracts/ProxyAdmin(Marketplace).sol:SecondSwapMarketplaceProxyAdmin",
    // address: "0xb0488F0e9c15C36A89a442BCD2c399337a7b9e62",

    // // MarketplaceProxy Contract
    // contract: "contracts/SecondSwap_Marketplace(Upgradable).sol:SecondSwap_Marketplace_V1",
    // address: "0x59E3116485e8c59D4E00BB8e437CD5c3b661adf8",

    // // TransparentUpgradeableProxy Contract
    // contract: "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
    // address: "0x91fd4470692A1cA1966B754BaD41bf486181166D",
    //
    // contract: "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol:ProxyAdmin",
    // address: "0x90E87411E0324654a64BFeddD666e77DaaE5c9f1",
    constructorArguments: [
      // '0x48aB8E0A4Df0C75F793500ea9820B79e3e485101','0x55d398326f99059fF775485246999027B3197955'
      // StepVesting
      // '0xF206fdf2ECC68F5B9a3b70272E9629c2869c1Cd5', // TokenIssuer (The user account address that created the vesting)
      // '0x6723a8f47B63cF7fcd68a4c93faF060B96A3eB2b', // Manager(At the moment, it is the contract)
      // '0x4084b96b51Ee47Ec2730297a36A3BA1D91a8a721', // token
      // '1732517966', // startTime
      // '1732604366', // endTime
      // '250', // num of steps
      // '0xF5b7454A80ee57B25b250adab203C6e226dAca68' //vesting deployer
      // Vesting Manager
      // '0xF206fdf2ECC68F5B9a3b70272E9629c2869c1Cd5', // s2admin
      // '0xF206fdf2ECC68F5B9a3b70272E9629c2869c1Cd5' // s2 dev
      // Marketplace
      // '0x9DAd21f55dE4ac53AD97B191089639AC97Bf3a85', // SecondSwap_VestingManager address
      // '0x0F613eE4E8c8edC695B9fbCDe4e4Ae8F950Efe4D', // SecondSwap_WhitelistDeployer address
      // '0x89Aad8E9d593F1879bCC4e59C06C6892ff9cD0f3', // s2admin
      // '0x89Aad8E9d593F1879bCC4e59C06C6892ff9cD0f3', // s2dev
      // '0x89Aad8E9d593F1879bCC4e59C06C6892ff9cD0f3', // token
      // WhitelistDeployer (no constructor)
      // Whitelist
      // "2", //total whitelist user
      // "0x477a8F88a52E685FA8d0dFd02Ea047983e04990A", //seller
      // ProxyAdmin
      // "0xF206fdf2ECC68F5B9a3b70272E9629c2869c1Cd5" //s2Dev
      // SecondSwapMarketplaceProxy (No constructor)
      // '0xF206fdf2ECC68F5B9a3b70272E9629c2869c1Cd5', // SecondSwap_VestingManager address
      // '0xF206fdf2ECC68F5B9a3b70272E9629c2869c1Cd5', // SecondSwap_WhitelistDeployer address
      // '0xF206fdf2ECC68F5B9a3b70272E9629c2869c1Cd5', // s2admin
      // '0xF206fdf2ECC68F5B9a3b70272E9629c2869c1Cd5', // s2dev
      // '0x89Aad8E9d593F1879bCC4e59C06C6892ff9cD0f3', // token
      // VestingDeployer no contsructor
      // Transparent Proxy
      // "0x262259e2040a44aBC8C9AeD61700376397dD7d14",// Implementation
      // "0xFd98EeE83b35530C7CA0e27Fc01f7c72FF1cba50",// Proxy Admin
      // "0x1459457a000000000000000000000000809e47a495d6ad2f995721e7e9112bed75aec3730000000000000000000000009187350a5c8badc989dee49888f1d8da5fd90a84000000000000000000000000f206fdf2ecc68f5b9a3b70272e9629c2869c1cd5000000000000000000000000f206fdf2ecc68f5b9a3b70272e9629c2869c1cd500000000000000000000000089aad8e9d593f1879bcc4e59c06c6892ff9cd0f3"// byte code (default is 0x)
      // ProxyAdmin
      // "0xF206fdf2ECC68F5B9a3b70272E9629c2869c1Cd5" // Admin initial owner
    ],
  });
  console.log("-----------------------------------------------------------------------\n");
}

main()
  .then(() => console.log("Verified"))
  .catch((e) => console.log(e));

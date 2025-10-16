import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";

// Import contract ABIs
import MatchManagerABI from "../../../contracts/artifacts/src/TradeClub_MatchManager.sol/TradeClub_MatchManager.json";
import DelegationRegistryABI from "../../../contracts/artifacts/src/TradeClub_DelegationRegistry.sol/TradeClub_DelegationRegistry.json";
import TradeClubTokenABI from "../../../contracts/artifacts/src/TradeClub_GovernanceToken.sol/TradeClub_GovernanceToken.json";
import BribePoolABI from "../../../contracts/artifacts/src/TradeClub_BribePool.sol/TradeClub_BribePool.json";

@Injectable()
export class ContractService implements OnModuleInit {
  public provider: ethers.JsonRpcProvider;
  public wallet: ethers.Wallet;
  public matchManager: ethers.Contract;
  public delegationRegistry: ethers.Contract;
  public govToken: ethers.Contract;
  public bribePool: ethers.Contract;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const rpcUrl = this.configService.get<string>("MONAD_RPC_URL");
    const privateKey = this.configService.get<string>("PRIVATE_KEY");

    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);

    console.log("💓 Connecting to blockchain...");
    console.log("RPC URL:", rpcUrl);
    console.log("Wallet:", this.wallet.address);

    // Initialize contracts
    const matchManagerAddress = this.configService.get<string>(
      "MATCH_MANAGER_ADDRESS",
    );
    const delegationRegistryAddress = this.configService.get<string>(
      "DELEGATION_REGISTRY_ADDRESS",
    );
    const govTokenAddress = this.configService.get<string>(
      "GOVERNANCE_TOKEN_ADDRESS",
    );
    const bribePoolAddress =
      this.configService.get<string>("BRIBE_POOL_ADDRESS");

    this.matchManager = new ethers.Contract(
      matchManagerAddress,
      MatchManagerABI.abi,
      this.wallet,
    );

    this.delegationRegistry = new ethers.Contract(
      delegationRegistryAddress,
      DelegationRegistryABI.abi,
      this.wallet,
    );

    this.govToken = new ethers.Contract(
      govTokenAddress,
      TradeClubTokenABI.abi,
      this.wallet,
    );

    this.bribePool = new ethers.Contract(
      bribePoolAddress,
      BribePoolABI.abi,
      this.wallet,
    );

    console.log("Contracts initialized");
    console.log("MatchManager:", matchManagerAddress);
    console.log("DelegationRegistry:", delegationRegistryAddress);
    console.log("TradeClubToken:", govTokenAddress);
    console.log("BribePool:", bribePoolAddress);

    // Verify connection
    try {
      const network = await this.provider.getNetwork();
      console.log(
        "Connected to network:",
        network.name,
        "(chainId:",
        network.chainId.toString(),
        ")",
      );
    } catch (error) {
      console.error("Failed to connect to blockchain:", error);
    }
  }

  // Helper methods
  async getMatch(matchId: number | string) {
    return await this.matchManager.getMatch(matchId);
  }

  async getMatchParticipants(matchId: number | string) {
    return await this.matchManager.getMatchParticipants(matchId);
  }

  async getDelegation(delegationHash: string) {
    return await this.delegationRegistry.getDelegation(delegationHash);
  }

  async isValidDelegation(delegationHash: string): Promise<boolean> {
    return await this.delegationRegistry.isValidDelegation(delegationHash);
  }

  async updatePnL(matchId: number | string, participant: string, pnl: bigint) {
    const tx = await this.matchManager.updatePnL(matchId, participant, pnl);
    return await tx.wait();
  }

  async executeDelegatedTrade(
    delegationHash: string,
    target: string,
    value: bigint,
    data: string,
  ) {
    const tx = await this.delegationRegistry.executeDelegatedTrade(
      delegationHash,
      target,
      value,
      data,
    );
    return await tx.wait();
  }

  // Utility methods
  parseEther(value: string): bigint {
    return ethers.parseEther(value);
  }

  formatEther(value: bigint): string {
    return ethers.formatEther(value);
  }

  parseUnits(value: string, decimals: number): bigint {
    return ethers.parseUnits(value, decimals);
  }

  formatUnits(value: bigint, decimals: number): string {
    return ethers.formatUnits(value, decimals);
  }
}

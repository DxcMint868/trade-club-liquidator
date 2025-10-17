import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";

// Import contract ABIs from local abi folder
import MatchManagerABI from "../abi/TradeClub_MatchManager.json";
import TradeClubTokenABI from "../abi/TradeClub_GovernanceToken.json";
import BribePoolABI from "../abi/TradeClub_BribePool.json";

/**
 * Service for interacting with blockchain contracts
 * Supports MetaMask Delegation Framework for copy trading
 */
@Injectable()
export class ContractService implements OnModuleInit {
  public provider: ethers.JsonRpcProvider;
  public wallet: ethers.Wallet;
  public matchManager: ethers.Contract;
  public govToken: ethers.Contract;
  public bribePool: ethers.Contract;

  // MetaMask Delegation Framework support (will be initialized when needed)
  private delegationManagerAddress: string;
  private allowedEnforcers: {
    allowedTargets: string;
    allowedMethods: string;
    timestamp: string;
    valueLte: string;
    limitedCalls: string;
  };

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const rpcUrl = this.configService.get<string>("MONAD_RPC_URL");
    const privateKey = this.configService.get<string>("PRIVATE_KEY");

    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    console.log("Connecting to blockchain...");
    console.log("RPC URL:", rpcUrl);
    console.log("Wallet:", this.wallet.address);

    // Initialize contracts
    const matchManagerAddress = this.configService.get<string>(
      "MATCH_MANAGER_ADDRESS"
    );
    const govTokenAddress = this.configService.get<string>(
      "GOVERNANCE_TOKEN_ADDRESS"
    );
    const bribePoolAddress =
      this.configService.get<string>("BRIBE_POOL_ADDRESS");

    console.log("Contract Addresses from .env:");
    console.log("  MATCH_MANAGER_ADDRESS:", matchManagerAddress);
    console.log("  GOVERNANCE_TOKEN_ADDRESS:", govTokenAddress);
    console.log("  BRIBE_POOL_ADDRESS:", bribePoolAddress);

    if (!matchManagerAddress || !govTokenAddress || !bribePoolAddress) {
      console.error("Missing required contract addresses in .env file!");
      console.error(
        "Please set MATCH_MANAGER_ADDRESS, GOVERNANCE_TOKEN_ADDRESS, and BRIBE_POOL_ADDRESS"
      );
      throw new Error("Missing contract addresses in environment variables");
    }

    // MetaMask Delegation Framework addresses
    this.delegationManagerAddress = this.configService.get<string>(
      "DELEGATION_MANAGER_ADDRESS",
      "0xc5d58A1569D82e7f6Be4C35c8dbBe0B6E87bE6ef" // Monad testnet default
    );

    this.allowedEnforcers = {
      allowedTargets: this.configService.get<string>(
        "ENFORCER_ALLOWED_TARGETS",
        "0x7F2065A48E32047474A9dF53C2e116c1e2de1b60"
      ),
      allowedMethods: this.configService.get<string>(
        "ENFORCER_ALLOWED_METHODS",
        "0xc5d58A1569D82e7f6Be4C35c8dbBe0B6E87bE6ef"
      ),
      timestamp: this.configService.get<string>(
        "ENFORCER_TIMESTAMP",
        "0x1046aA7c37D64b1F6B8ef1c90D7989C1E66f8C5F"
      ),
      valueLte: this.configService.get<string>(
        "ENFORCER_VALUE_LTE",
        "0x61eCC94cE2883b0767507D2f6FAd77E07F27a21e"
      ),
      limitedCalls: this.configService.get<string>(
        "ENFORCER_LIMITED_CALLS",
        "0x44A6CbdECE346CF3dB30c53E9F062df5b7b09a11"
      ),
    };

    // Use wallet for signing if available, otherwise read-only with provider
    const signerOrProvider = this.wallet || this.provider;

    this.matchManager = new ethers.Contract(
      matchManagerAddress,
      MatchManagerABI.abi,
      signerOrProvider
    );

    this.govToken = new ethers.Contract(
      govTokenAddress,
      TradeClubTokenABI.abi,
      signerOrProvider
    );

    this.bribePool = new ethers.Contract(
      bribePoolAddress,
      BribePoolABI.abi,
      signerOrProvider
    );

    console.log("Contracts initialized");
    console.log("MatchManager:", matchManagerAddress);
    console.log("DelegationManager:", this.delegationManagerAddress);
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
        ")"
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

  /**
   * Get the DeleGator (smart account) address for a user
   * Uses CREATE2 deterministic deployment to predict the address
   * @param userAddress - The EOA address of the user
   * @returns The predicted DeleGator address
   */
  async getUserSmartAccount(userAddress: string): Promise<string> {
    // MetaMask DelegationManager uses CREATE2 to deploy DeleGator contracts
    // We need to call getDelegatorAddress(userAddress) on the DelegationManager
    const delegationManagerABI = [
      "function getDelegatorAddress(address user) view returns (address)",
    ];

    const delegationManager = new ethers.Contract(
      this.delegationManagerAddress,
      delegationManagerABI,
      this.provider
    );

    return await delegationManager.getDelegatorAddress(userAddress);
  }

  /**
   * Check if a delegation is valid by querying the user's DeleGator
   * @param delegationHash - The keccak256 hash of the delegation
   * @param userAddress - The EOA address that created the delegation
   * @returns True if delegation exists and is enabled
   */
  async isDelegationValid(
    delegationHash: string,
    userAddress: string
  ): Promise<boolean> {
    try {
      const delegatorAddress = await this.getUserSmartAccount(userAddress);

      // DeleGator ABI for checking delegation status
      const delegatorABI = [
        "function delegations(bytes32) view returns (address delegate, address delegator, bool enabled)",
      ];

      const delegator = new ethers.Contract(
        delegatorAddress,
        delegatorABI,
        this.provider
      );

      const delegation = await delegator.delegations(delegationHash);
      return delegation.enabled;
    } catch (error) {
      console.error("Error checking delegation validity:", error);
      return false;
    }
  }

  /**
   * Get the current nonce for a user's smart account
   * Used for building UserOperations
   */
  async getNonce(userAddress: string): Promise<bigint> {
    const smartAccountAddress = await this.getUserSmartAccount(userAddress);

    // EntryPoint nonce function (standard ERC-4337)
    const entryPointABI = [
      "function getNonce(address sender, uint192 key) view returns (uint256)",
    ];

    // Standard EntryPoint v0.6 address (same across all chains)
    const entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

    const entryPoint = new ethers.Contract(
      entryPointAddress,
      entryPointABI,
      this.provider
    );

    return await entryPoint.getNonce(smartAccountAddress, 0);
  }

  /**
   * Get current maxFeePerGas from network
   */
  async getMaxFeePerGas(): Promise<bigint> {
    const feeData = await this.provider.getFeeData();
    return feeData.maxFeePerGas || ethers.parseUnits("2", "gwei");
  }

  /**
   * Get current maxPriorityFeePerGas from network
   */
  async getMaxPriorityFeePerGas(): Promise<bigint> {
    const feeData = await this.provider.getFeeData();
    return feeData.maxPriorityFeePerGas || ethers.parseUnits("1", "gwei");
  }

  async updatePnL(matchId: number | string, participant: string, pnl: bigint) {
    const tx = await this.matchManager.updatePnL(matchId, participant, pnl);
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

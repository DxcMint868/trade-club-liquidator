import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "../blockchain/monad-chain";
import {
  Implementation,
  toMetaMaskSmartAccount,
} from "@metamask/delegation-toolkit";
import { DatabaseService } from "../database/database.service";
import { defineChain } from "viem";

export interface DeploySmartAccountDto {
  userAddress: string;
  implementation?: "Hybrid" | "MultiSig";
  deployParams: any[];
  deploySalt: string;
}

@Injectable()
export class SmartAccountService {
  private readonly logger = new Logger(SmartAccountService.name);
  private publicClient: any;
  private walletClient: any;
  private relayerAccount: any;
  private readonly chainConfig = {
    10143: defineChain({
      id: 10143,
      name: "Monad Testnet",
      nativeCurrency: {
        decimals: 18,
        name: "Monad",
        symbol: "MON",
      },
      rpcUrls: {
        default: {
          http: ["https://testnet-rpc.monad.xyz"],
        },
        public: {
          http: ["https://testnet-rpc.monad.xyz"],
        },
      },
      blockExplorers: {
        default: {
          name: "Monad Explorer",
          url: "https://testnet-explorer.monad.xyz",
        },
      },
      testnet: true,
    }),
    85432: defineChain({
      id: 85432,
      name: "Base Sepolia Testnet",
      nativeCurrency: {
        decimals: 18,
        name: "Base Sepolia Ether",
        symbol: "ETH",
      },
      rpcUrls: {
        default: {
          http: ["https://base-sepolia.gateway.tenderly.co"],
        },
        public: {
          http: ["https://base-sepolia.gateway.tenderly.co"],
        },
      },
      blockExplorers: {
        default: {
          name: "Base Sepolia Explorer",
          url: "https://sepolia.base.blockscout.com",
        },
      },
      testnet: true,
    }),
    11155111: defineChain({
      id: 11155111,
      name: "Sepolia Testnet",
      nativeCurrency: {
        decimals: 18,
        name: "Sepolia Ether",
        symbol: "ETH",
      },
      rpcUrls: {
        default: {
          http: [this.configService.get<string>("RPC_URL")],
        },
        public: {
          http: [
            "https://rpc.sepolia.ethpandaops.io",
            "https://eth-sepolia.public.blastapi.io",
          ],
        },
      },
      blockExplorers: {
        default: {
          name: "Etherscan Sepolia",
          url: "https://sepolia.etherscan.io",
        },
      },
      testnet: true,
    }),
  };

  constructor(
    private configService: ConfigService,
    private db: DatabaseService
  ) {
    this.initializeClients();
  }

  private initializeClients() {
    const currentChainId = this.configService.get<number>("CHAIN_ID");
    if (!this.chainConfig[currentChainId]) {
      throw new Error(`Unsupported CHAIN_ID: ${currentChainId}`);
    }

    const relayerPrivateKey = this.configService.get<string>(
      "RELAYER_PRIVATE_KEY"
    );

    if (!relayerPrivateKey) {
      throw new Error("RELAYER_PRIVATE_KEY not configured");
    }

    this.relayerAccount = privateKeyToAccount(relayerPrivateKey as Hex);

    this.publicClient = createPublicClient({
      chain: this.chainConfig[currentChainId],
      transport: http(this.configService.get<string>("RPC_URL")),
    });

    this.walletClient = createWalletClient({
      account: this.relayerAccount,
      chain: this.chainConfig[currentChainId],
      transport: http(this.configService.get<string>("RPC_URL")),
    });

    this.logger.log(
      `Smart Account Service initialized with relayer: ${this.relayerAccount.address}`
    );
  }

  async deploySmartAccount(dto: DeploySmartAccountDto) {
    const { userAddress, implementation, deployParams, deploySalt } = dto;

    // Validation
    if (!userAddress || !deployParams || !deploySalt) {
      throw new BadRequestException("Missing required parameters");
    }

    // Validate hex format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      throw new BadRequestException("Invalid userAddress format");
    }

    if (!/^0x[a-fA-F0-9]*$/.test(deploySalt)) {
      throw new BadRequestException("Invalid deploySalt format");
    }

    try {
      this.logger.log(
        `Deploying smart account for user: ${userAddress} with implementation: ${implementation || "Hybrid"}`
      );

      // Step 1: Create smart account object to get deployment data
      const smartAccount = await toMetaMaskSmartAccount({
        client: this.publicClient,
        implementation:
          implementation === "MultiSig"
            ? Implementation.MultiSig
            : Implementation.Hybrid,
        deployParams: deployParams as any,
        deploySalt: deploySalt as Hex,
        signer: { account: this.relayerAccount }, // Use relayer for deployment
      });

      const smartAccountAddress = smartAccount.address;
      this.logger.log(`Smart account address: ${smartAccountAddress}`);

      // Step 2: Check if already deployed
      const existingCode = await this.publicClient.getCode({
        address: smartAccountAddress,
      });

      if (existingCode && existingCode !== "0x") {
        this.logger.log("Smart account already deployed");
        return {
          smartAccountAddress,
          txHash: null,
          status: "already-deployed",
          message: "Smart account already exists at this address",
        };
      }

      // Step 3: Get factory and deployment data
      const { factory, factoryData } = await smartAccount.getFactoryArgs();
      this.logger.log(`Factory: ${factory}`);

      // Step 4: Estimate gas
      const gasEstimate = await this.publicClient.estimateGas({
        account: this.relayerAccount,
        to: factory,
        data: factoryData,
        value: 0n,
      });

      this.logger.log(`Gas estimate: ${gasEstimate}`);

      // Step 5: Send deployment transaction from relayer
      const txHash = await this.walletClient.sendTransaction({
        to: factory,
        data: factoryData,
        value: 0n,
        gas: (gasEstimate * 12n) / 10n, // 20% buffer
      });

      this.logger.log(`Deployment tx sent: ${txHash}`);

      // Step 6: Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      this.logger.log(`Deployment confirmed at block: ${receipt.blockNumber}`);

      // Step 7: Verify deployment
      const deployedCode = await this.publicClient.getCode({
        address: smartAccountAddress,
      });

      if (!deployedCode || deployedCode === "0x") {
        throw new Error("Deployment verification failed - no code at address");
      }

      // Step 8: Store in database
      await this.storeSmartAccount(
        userAddress,
        smartAccountAddress,
        txHash,
        receipt.blockNumber.toString()
      );

      return {
        smartAccountAddress,
        txHash,
        status: "deployed",
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error: any) {
      this.logger.error("Deployment failed:", error);
      throw new BadRequestException(
        `Deployment failed: ${error.message || "Unknown error"}`
      );
    }
  }

  async checkDeploymentStatus(ownerAddress: string) {
    try {
      const smartAccountAddress = await this.deriveSmartAccountFromEOA(
        ownerAddress as Hex,
        Implementation.Hybrid
      );
      const code = await this.publicClient.getCode({
        address: smartAccountAddress as Hex,
      });

      const isDeployed = code && code !== "0x";

      return {
        smartAccountAddress,
        isDeployed,
        code: isDeployed ? code : null,
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to check deployment: ${error.message}`
      );
    }
  }

  private async storeSmartAccount(
    ownerAddress: string,
    smartAccountAddress: string,
    txHash: string,
    blockNumber: string
  ) {
    // Store smart account registration in a simple way
    // You can create a SmartAccount model in Prisma if needed
    this.logger.log(
      `Storing smart account: ${smartAccountAddress} for owner: ${ownerAddress}`
    );
  }

  private async deriveSmartAccountFromEOA(
    ownerAddress: Hex,
    implementation: Implementation
  ) {
    const smartAccount = await toMetaMaskSmartAccount({
      client: this.publicClient,
      implementation,
      deployParams: [ownerAddress, [], [], []],
      deploySalt: "0x00" as Hex,
      signer: { account: this.relayerAccount },
    });
    return smartAccount.address;
  }
}

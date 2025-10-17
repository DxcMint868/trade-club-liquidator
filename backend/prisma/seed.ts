import { PrismaClient, MatchStatus } from "@prisma/client";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  decodeEventLog,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
// import { abi as MATCH_MANAGER_ABI } from "../src/abi/TradeClub_MatchManager.json";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// Contract ABI - just the functions we need for seeding
const MATCH_MANAGER_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "_entryMargin", type: "uint256" },
      { internalType: "uint256", name: "_duration", type: "uint256" },
      { internalType: "uint256", name: "_maxMonachads", type: "uint256" },
      {
        internalType: "uint256",
        name: "_maxSupportersPerMonachad",
        type: "uint256",
      },
      {
        internalType: "address[]",
        name: "_allowedDexes",
        type: "address[]",
      },
    ],
    name: "createMatch",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "creator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "entryMargin",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "duration",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "maxMonachads",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "maxSupportersPerMonachad",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "allowedDexes",
        type: "address[]",
      },
    ],
    name: "MatchCreated",
    type: "event",
  },
  {
    inputs: [{ internalType: "uint256", name: "_matchId", type: "uint256" }],
    name: "getMatch",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "id", type: "uint256" },
          { internalType: "address", name: "creator", type: "address" },
          { internalType: "uint256", name: "entryMargin", type: "uint256" },
          { internalType: "uint256", name: "duration", type: "uint256" },
          { internalType: "uint256", name: "startTime", type: "uint256" },
          { internalType: "uint256", name: "endTime", type: "uint256" },
          { internalType: "uint256", name: "maxMonachads", type: "uint256" },
          {
            internalType: "uint256",
            name: "maxSupportersPerMonachad",
            type: "uint256",
          },
          { internalType: "uint256", name: "prizePool", type: "uint256" },
          {
            internalType: "enum TradeClub_IMatchManager.MatchStatus",
            name: "status",
            type: "uint8",
          },
          {
            internalType: "address[]",
            name: "monachads",
            type: "address[]",
          },
          { internalType: "address", name: "winner", type: "address" },
          {
            internalType: "address[]",
            name: "allowedDexes",
            type: "address[]",
          },
        ],
        internalType: "struct TradeClub_IMatchManager.Match",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function main() {
  console.log("🌱 Seeding database with real on-chain matches...");

  // Setup blockchain connection
  const rpcUrl = process.env.RPC_URL!;
  const privateKey = process.env.PRIVATE_KEY! as `0x${string}`;
  const matchManagerAddress = process.env
    .MATCH_MANAGER_ADDRESS! as `0x${string}`;

  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  console.log(`📡 Connected to ${sepolia.name}`);
  console.log(`👤 Using account: ${account.address}`);
  console.log(`📝 MatchManager at: ${matchManagerAddress}`);

  // Define matches to create on-chain
  // Contract requires: duration between 1-24 hours, maxParticipants between 2-10
  const fundexAddress = process.env.FUNDEX_ADDRESS! as `0x${string}`;
  
  const matchesToCreate = [
    {
      entryMargin: parseEther("0.01"), // 0.01 ETH
      duration: 3600, // 1 hour (minimum allowed)
      maxMonachads: 5,
      maxSupportersPerMonachad: 20,
      allowedDexes: [fundexAddress],
      value: parseEther("0.01"),
    },
    {
      entryMargin: parseEther("0.005"), // 0.005 ETH
      duration: 43200, // 12 hours
      maxMonachads: 10,
      maxSupportersPerMonachad: 50,
      allowedDexes: [fundexAddress],
      value: parseEther("0.005"),
    },
    {
      entryMargin: parseEther("0.02"), // 0.02 ETH
      duration: 86400, // 24 hours (maximum allowed)
      maxMonachads: 2,
      maxSupportersPerMonachad: 100,
      allowedDexes: [fundexAddress],
      value: parseEther("0.02"),
    },
  ];

  // Create matches on-chain
  // for (let i = 0; i < matchesToCreate.length; i++) {
  for (let i = 0; i < 1; i++) {
    const matchConfig = matchesToCreate[i];

    try {
      console.log(`\nCreating match ${i + 1}...`);
      console.log(`  Entry Margin: ${matchConfig.entryMargin} wei`);
      console.log(`  Duration: ${matchConfig.duration}s`);
      console.log(`  Max Monachads: ${matchConfig.maxMonachads}`);
      console.log(
        `  Max Supporters per Monachad: ${matchConfig.maxSupportersPerMonachad}`
      );

      // Create match on-chain
      const hash = await walletClient.writeContract({
        address: matchManagerAddress,
        abi: MATCH_MANAGER_ABI,
        functionName: "createMatch",
        args: [
          matchConfig.entryMargin,
          BigInt(matchConfig.duration),
          BigInt(matchConfig.maxMonachads),
          BigInt(matchConfig.maxSupportersPerMonachad),
          matchConfig.allowedDexes,
        ],
        value: matchConfig.value,
        account,
        chain: sepolia,
      });

      console.log(`  Transaction sent: ${hash}`);
      console.log(`  Waiting for confirmation...`);

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  Confirmed in block ${receipt.blockNumber}`);

      // Parse the MatchCreated event to get the real match ID
      let matchIdDecimal: number | null = null;

      for (const log of receipt.logs) {
        try {
          const decoded: any = decodeEventLog({
            abi: MATCH_MANAGER_ABI,
            data: log.data,
            topics: (log as any).topics,
          });

          if (decoded.eventName === "MatchCreated") {
            matchIdDecimal = Number(decoded.args.matchId);
            break;
          }
        } catch (e) {
          // Not the event we're looking for, continue
          continue;
        }
      }

      if (matchIdDecimal === null) {
        throw new Error(
          "Could not find MatchCreated event in transaction logs"
        );
      }

      console.log(`  🎯 Match ID from blockchain: ${matchIdDecimal}`);

      // Fetch match data from contract
      const rawMatchData: any = await publicClient.readContract({
        address: matchManagerAddress,
        abi: MATCH_MANAGER_ABI,
        functionName: "getMatch",
        args: [BigInt(matchIdDecimal)],
      } as any);

      // Contract returns a struct - viem may return it as object or array depending on version
      // Handle both cases
      let id,
        creator,
        entryMargin,
        duration,
        startTime,
        endTime,
        maxMonachads,
        maxSupportersPerMonachad,
        prizePool,
        status,
        monachads,
        winner,
        allowedDexes;

      if (Array.isArray(rawMatchData)) {
        // Tuple/array format: [id, creator, entryMargin, duration, startTime, endTime, maxMonachads, maxSupportersPerMonachad, prizePool, status, monachads, winner, allowedDexes]
        [
          id,
          creator,
          entryMargin,
          duration,
          startTime,
          endTime,
          maxMonachads,
          maxSupportersPerMonachad,
          prizePool,
          status,
          monachads,
          winner,
          allowedDexes,
        ] = rawMatchData;
      } else {
        // Object format
        ({
          id,
          creator,
          entryMargin,
          duration,
          startTime,
          endTime,
          maxMonachads,
          maxSupportersPerMonachad,
          prizePool,
          status,
          monachads,
          winner,
          allowedDexes,
        } = rawMatchData);
      }

      console.log(
        `  📊 Match data: entry=${entryMargin}, duration=${duration}, maxMonachads=${maxMonachads}, pool=${prizePool}`
      );

      // Map contract status to Prisma enum
      const statusMap: { [key: number]: MatchStatus } = {
        0: MatchStatus.CREATED,
        1: MatchStatus.ACTIVE,
        2: MatchStatus.COMPLETED,
        3: MatchStatus.SETTLED,
      };

      // Parse and validate data
      const parsedStartTime =
        startTime && Number(startTime) > 0
          ? new Date(Number(startTime) * 1000)
          : null;
      const parsedEndTime =
        endTime && Number(endTime) > 0
          ? new Date(Number(endTime) * 1000)
          : null;
      const parsedWinner =
        winner && winner !== "0x0000000000000000000000000000000000000000"
          ? winner.toLowerCase()
          : null;

      // Insert into database
      await prisma.match.upsert({
        where: { matchId: matchIdDecimal.toString() },
        update: {
          creator: creator.toLowerCase(),
          entryMargin: entryMargin.toString(),
          duration: Number(duration),
          maxParticipants: Number(maxMonachads),
          maxSupporters: Number(maxSupportersPerMonachad),
          prizePool: prizePool.toString(),
          status: statusMap[status] || MatchStatus.CREATED,
          startTime: parsedStartTime,
          endTime: parsedEndTime,
          winner: parsedWinner,
          allowedDexes: allowedDexes.map((addr: string) => addr.toLowerCase()),
          blockNumber: Number(receipt.blockNumber),
          transactionHash: hash,
          createdTxHash: hash,
        },
        create: {
          matchId: matchIdDecimal.toString(),
          creator: creator.toLowerCase(),
          entryMargin: entryMargin.toString(),
          duration: Number(duration),
          maxParticipants: Number(maxMonachads),
          maxSupporters: Number(maxSupportersPerMonachad),
          prizePool: prizePool.toString(),
          status: statusMap[status] || MatchStatus.CREATED,
          startTime: parsedStartTime,
          endTime: parsedEndTime,
          winner: parsedWinner,
          allowedDexes: allowedDexes.map((addr: string) => addr.toLowerCase()),
          blockNumber: Number(receipt.blockNumber),
          transactionHash: hash,
          createdTxHash: hash,
        },
      });

      // Add creator as participant (Monachad)
      await prisma.participant.upsert({
        where: {
          matchId_address: {
            matchId: matchIdDecimal.toString(),
            address: creator.toLowerCase(),
          },
        },
        update: {
          role: "MONACHAD",
          stakedAmount: entryMargin.toString(),
          joinedTxHash: hash,
        },
        create: {
          matchId: matchIdDecimal.toString(),
          address: creator.toLowerCase(),
          role: "MONACHAD",
          followingAddress: null,
          stakedAmount: entryMargin.toString(),
          pnl: "0",
          joinedTxHash: hash,
        },
      });

      console.log(`  💾 Saved to database: Match ${matchIdDecimal}`);
    } catch (error: any) {
      console.error(`  ❌ Failed to create match ${i + 1}:`, error.message);
    }
  }

  console.log("\n✅ Database seeding completed!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient, MatchStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data (optional - comment out if you want to keep existing data)
  // await prisma.match.deleteMany({});

  // Create some test matches
  const matches = [
    {
      matchId: "0x1",
      creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
      entryMargin: "1000000000000000000", // 1 ETH
      duration: 86400, // 1 day
      maxParticipants: 20,
      prizePool: "5000000000000000000", // 5 ETH
      status: MatchStatus.ACTIVE,
      startTime: new Date(),
      blockNumber: 1000,
      transactionHash: "0x" + "1".repeat(64),
      createdTxHash: "0x" + "1".repeat(64),
      startedTxHash: "0x" + "2".repeat(64),
    },
    {
      matchId: "0x2",
      creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
      entryMargin: "500000000000000000", // 0.5 ETH
      duration: 172800, // 2 days
      maxParticipants: 50,
      prizePool: "10000000000000000000", // 10 ETH
      status: MatchStatus.CREATED,
      blockNumber: 1001,
      transactionHash: "0x" + "3".repeat(64),
      createdTxHash: "0x" + "3".repeat(64),
    },
    {
      matchId: "0x3",
      creator: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
      entryMargin: "2000000000000000000", // 2 ETH
      duration: 259200, // 3 days
      maxParticipants: 10,
      prizePool: "15000000000000000000", // 15 ETH
      status: MatchStatus.ACTIVE,
      startTime: new Date(Date.now() - 3600000), // Started 1 hour ago
      blockNumber: 1002,
      transactionHash: "0x" + "4".repeat(64),
      createdTxHash: "0x" + "4".repeat(64),
      startedTxHash: "0x" + "5".repeat(64),
    },
    {
      matchId: "0x4",
      creator: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
      entryMargin: "100000000000000000", // 0.1 ETH
      duration: 43200, // 12 hours
      maxParticipants: 100,
      prizePool: "2000000000000000000", // 2 ETH
      status: MatchStatus.CREATED,
      blockNumber: 1003,
      transactionHash: "0x" + "6".repeat(64),
      createdTxHash: "0x" + "6".repeat(64),
    },
    {
      matchId: "0x5",
      creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
      entryMargin: "5000000000000000000", // 5 ETH
      duration: 604800, // 1 week
      maxParticipants: 5,
      prizePool: "20000000000000000000", // 20 ETH
      status: MatchStatus.CREATED,
      blockNumber: 1004,
      transactionHash: "0x" + "7".repeat(64),
      createdTxHash: "0x" + "7".repeat(64),
    },
  ];

  for (const match of matches) {
    try {
      await prisma.match.upsert({
        where: { matchId: match.matchId },
        update: match,
        create: match,
      });
      console.log(`Seeded match: ${match.matchId}`);
    } catch (error) {
      console.error(`Failed to seed match ${match.matchId}:`, error);
    }
  }

  // Add some participants to active matches
  const participants = [
    {
      matchId: "0x1",
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
      stakedAmount: "1000000000000000000",
      pnl: "250000000000000000", // +0.25 ETH profit
      joinedTxHash: "0x" + "a".repeat(64),
    },
    {
      matchId: "0x1",
      address: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
      stakedAmount: "1000000000000000000",
      pnl: "-100000000000000000", // -0.1 ETH loss
      joinedTxHash: "0x" + "b".repeat(64),
    },
    {
      matchId: "0x3",
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
      stakedAmount: "2000000000000000000",
      pnl: "500000000000000000", // +0.5 ETH profit
      joinedTxHash: "0x" + "c".repeat(64),
    },
  ];

  for (const participant of participants) {
    try {
      await prisma.participant.upsert({
        where: {
          matchId_address: {
            matchId: participant.matchId,
            address: participant.address,
          },
        },
        update: participant,
        create: participant,
      });
      console.log(
        `Seeded participant: ${participant.address} in match ${participant.matchId}`
      );
    } catch (error) {
      console.error(`Failed to seed participant:`, error);
    }
  }

  console.log("Database seeding completed!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

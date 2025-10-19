import { Test, TestingModule } from "@nestjs/testing";
import { MatchesService } from "./matches.service";
import { DatabaseService } from "../database/database.service";
import { ContractService } from "../blockchain/contract.service";
import { MatchStatus, ParticipantRole } from "@prisma/client";

describe("MatchesService", () => {
  let service: MatchesService;
  let databaseService: DatabaseService;

  const mockDatabaseService = {
    match: {
      create: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    participant: {
      create: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockContractService = {
    getMatch: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: ContractService,
          useValue: mockContractService,
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("handleMatchCreated", () => {
    it("should create a match record", async () => {
      const payload = {
        matchId: "match-1",
        creator: "0xCreator",
        entryMargin: "1000000000000000000",
        duration: "3600",
        maxParticipants: "10",
        blockNumber: 12345,
        transactionHash: "0xTx123",
      };

      mockDatabaseService.match.upsert.mockResolvedValue({
        id: "db-match-1",
        matchId: payload.matchId,
      });

      const result = await service.createMatch(payload);

      expect(mockDatabaseService.match.upsert).toHaveBeenCalledWith({
        where: { matchId: "match-1" },
        update: expect.objectContaining({
          creator: "0xcreator",
          entryMargin: "1000000000000000000",
          duration: 3600,
          maxParticipants: 10,
          allowedDexes: [],
          blockNumber: 12345,
          transactionHash: "0xTx123",
          createdTxHash: "0xTx123",
          updatedAt: expect.any(Date),
        }),
        create: expect.objectContaining({
          matchId: "match-1",
          creator: "0xcreator",
          entryMargin: "1000000000000000000",
          duration: 3600,
          maxParticipants: 10,
          prizePool: "0",
          status: MatchStatus.CREATED,
          allowedDexes: [],
          createdTxHash: "0xTx123",
          blockNumber: 12345,
          transactionHash: "0xTx123",
        }),
      });

      expect(result).toEqual({
        matchId: "match-1",
        creator: "0xcreator",
        entryMargin: "1000000000000000000",
        duration: 3600,
        maxParticipants: 10,
        maxSupportersPerMonachad: undefined,
        allowedDexes: [],
        blockNumber: 12345,
        transactionHash: "0xTx123",
      });
    });
  });

  describe("handleParticipantJoined", () => {
    it("should create a participant record", async () => {
      const payload = {
        matchId: "match-1",
        participant: "0xParticipant",
        marginAmount: "1000000000000000000",
        entryFee: "100000000000000000",
        transactionHash: "0xJoinTx",
        role: ParticipantRole.MONACHAD,
      };

      mockDatabaseService.participant.upsert.mockResolvedValue({
        id: "participant-1",
        ...payload,
      });

      const result = await service.upsertParticipant(payload);

      expect(mockDatabaseService.participant.upsert).toHaveBeenCalledWith({
        where: {
          matchId_address: {
            matchId: "match-1",
            address: "0xparticipant",
          },
        },
        update: expect.objectContaining({
          role: ParticipantRole.MONACHAD,
          followingAddress: null,
          marginAmount: "1000000000000000000",
          entryFeePaid: "100000000000000000",
          joinedTxHash: "0xJoinTx",
          updatedAt: expect.any(Date),
        }),
        create: expect.objectContaining({
          matchId: "match-1",
          address: "0xparticipant",
          role: ParticipantRole.MONACHAD,
          followingAddress: null,
          marginAmount: "1000000000000000000",
          entryFeePaid: "100000000000000000",
          pnl: "0",
          joinedTxHash: "0xJoinTx",
        }),
      });

      expect(result).toEqual({
        matchId: "match-1",
        participant: "0xparticipant",
        marginAmount: "1000000000000000000",
        entryFee: "100000000000000000",
        transactionHash: "0xJoinTx",
        blockNumber: undefined,
        role: "MONACHAD",
        followingAddress: undefined,
        smartAccount: undefined,
        fundedAmount: undefined,
      });
    });

    it("should derive supporter stake from entry fee when missing", async () => {
      const payload = {
        matchId: "match-2",
        participant: "0xSupporter",
        transactionHash: "0xJoinSupporter",
        role: ParticipantRole.SUPPORTER,
        entryFee: "250000000000000000",
        followingAddress: "0xMonachad",
      };

      mockDatabaseService.participant.upsert.mockResolvedValue({
        id: "participant-2",
        ...payload,
      });

      const result = await service.upsertParticipant(payload);

      expect(mockDatabaseService.participant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            matchId_address: {
              matchId: "match-2",
              address: "0xsupporter",
            },
          },
        })
      );

      expect(result).toEqual(
        expect.objectContaining({
          entryFee: "250000000000000000",
          role: "SUPPORTER",
          followingAddress: "0xmonachad",
        })
      );
    });
  });

  describe("handleMatchStarted", () => {
    it("should update match status to ACTIVE", async () => {
      const payload = {
        matchId: "match-1",
        startTime: "1700000000",
        transactionHash: "0xStartTx",
      };

      mockDatabaseService.match.updateMany.mockResolvedValue({ count: 1 });

      // const result = await (payload);

      expect(mockDatabaseService.match.updateMany).toHaveBeenCalledWith({
        where: { matchId: "match-1" },
        data: expect.objectContaining({
          status: MatchStatus.ACTIVE,
          startedTxHash: "0xStartTx",
          updatedAt: expect.any(Date),
          startTime: expect.any(Date),
        }),
      });

      // expect(result).toEqual({
      //   matchId: "match-1",
      //   startTime: "1700000000",
      //   transactionHash: "0xStartTx",
      //   blockNumber: undefined,
      //   __synced: false,
      // });
    });
  });

  describe("handleMatchCompleted", () => {
    it("should update match status to COMPLETED with winner", async () => {
      const payload = {
        matchId: "match-1",
        winner: "0xWinner",
        prizePool: "5000000000000000000",
        transactionHash: "0xCompleteTx",
      };

      mockDatabaseService.match.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.completeMatch(payload);

      expect(mockDatabaseService.match.updateMany).toHaveBeenCalledWith({
        where: { matchId: "match-1" },
        data: expect.objectContaining({
          status: MatchStatus.COMPLETED,
          completedTxHash: "0xCompleteTx",
          endTime: expect.any(Date),
          updatedAt: expect.any(Date),
          winner: "0xwinner",
          prizePool: "5000000000000000000",
        }),
      });

      expect(result).toEqual({
        matchId: "match-1",
        winner: "0xwinner",
        prizePool: "5000000000000000000",
        transactionHash: "0xCompleteTx",
        blockNumber: undefined,
      });
    });
  });

  describe("getMatch", () => {
    it("should return a match with participants", async () => {
      const mockMatch = {
        id: "match-1",
        matchId: "match-1",
        status: MatchStatus.ACTIVE,
        participants: [
          { id: "p1", address: "0xaddr1" },
          { id: "p2", address: "0xaddr2" },
        ],
      };

      mockDatabaseService.match.findUnique.mockResolvedValue(mockMatch);

      const result = await service.getMatch("match-1");

      expect(result).toEqual(mockMatch);
      expect(mockDatabaseService.match.findUnique).toHaveBeenCalled();
    });
  });

  describe("getActiveMatches", () => {
    it("should return all active matches", async () => {
      const mockMatches = [
        {
          id: "match-1",
          matchId: "match-1",
          status: MatchStatus.ACTIVE,
        },
        {
          id: "match-2",
          matchId: "match-2",
          status: MatchStatus.ACTIVE,
        },
      ];

      mockDatabaseService.match.findMany.mockResolvedValue(mockMatches);

      const result = await service.getActiveMatches();

      expect(result).toEqual(mockMatches);
      expect(mockDatabaseService.match.findMany).toHaveBeenCalled();
    });
  });

  describe("getMatchLeaderboard", () => {
    it("should return leaderboard with performance metrics", async () => {
      const mockParticipants = [
        {
          id: "p1",
          address: "0xaddr1",
          matchId: "match-1",
          pnl: "150",
          marginAmount: "1000",
          entryFeePaid: "100",
          fundedAmount: null,
        },
      ];

      mockDatabaseService.participant.findMany.mockResolvedValue(
        mockParticipants
      );

      const result = await service.getMatchLeaderboard("match-1");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        rank: 1,
        address: "0xaddr1",
        pnl: "150",
        marginAmount: "1000",
      });
      expect(result[0].roi).toBeDefined();
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { MatchesService } from "./matches.service";
import { DatabaseService } from "../database/database.service";
import { ContractService } from "../blockchain/contract.service";
import { MatchStatus } from "@prisma/client";

describe("MatchesService", () => {
  let service: MatchesService;
  let databaseService: DatabaseService;

  const mockDatabaseService = {
    match: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    participant: {
      create: jest.fn(),
      findMany: jest.fn(),
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

      mockDatabaseService.match.create.mockResolvedValue({
        id: "db-match-1",
        ...payload,
        status: MatchStatus.CREATED,
      });

      await service.handleMatchCreated(payload);

      expect(mockDatabaseService.match.create).toHaveBeenCalledWith({
        data: {
          matchId: "match-1",
          creator: "0xcreator",
          entryMargin: "1000000000000000000",
          duration: 3600,
          maxParticipants: 10,
          prizePool: "0",
          status: MatchStatus.CREATED,
          createdTxHash: "0xTx123",
          blockNumber: 12345,
          transactionHash: "0xTx123",
        },
      });
    });
  });

  describe("handleParticipantJoined", () => {
    it("should create a participant record", async () => {
      const payload = {
        matchId: "match-1",
        participant: "0xParticipant",
        stakedAmount: "1000000000000000000",
        transactionHash: "0xJoinTx",
      };

      mockDatabaseService.participant.create.mockResolvedValue({
        id: "participant-1",
        ...payload,
      });

      await service.handleParticipantJoined(payload);

      expect(mockDatabaseService.participant.create).toHaveBeenCalledWith({
        data: {
          matchId: "match-1",
          address: "0xparticipant",
          stakedAmount: "1000000000000000000",
          pnl: "0",
          joinedTxHash: "0xJoinTx",
        },
      });
    });
  });

  describe("handleMatchStarted", () => {
    it("should update match status to ACTIVE", async () => {
      const payload = {
        matchId: "match-1",
        startTime: "1700000000",
        transactionHash: "0xStartTx",
      };

      mockDatabaseService.match.update.mockResolvedValue({
        id: "match-1",
        status: MatchStatus.ACTIVE,
      });

      await service.handleMatchStarted(payload);

      expect(mockDatabaseService.match.update).toHaveBeenCalledWith({
        where: { matchId: "match-1" },
        data: {
          status: MatchStatus.ACTIVE,
          startTime: expect.any(Date),
          startedTxHash: "0xStartTx",
        },
      });
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

      mockDatabaseService.match.update.mockResolvedValue({
        id: "match-1",
        status: MatchStatus.COMPLETED,
        winner: "0xwinner",
      });

      await service.handleMatchCompleted(payload);

      expect(mockDatabaseService.match.update).toHaveBeenCalledWith({
        where: { matchId: "match-1" },
        data: {
          status: MatchStatus.COMPLETED,
          winner: "0xwinner",
          prizePool: "5000000000000000000",
          endTime: expect.any(Date),
          completedTxHash: "0xCompleteTx",
        },
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
          stakedAmount: "1000",
        },
      ];

      mockDatabaseService.participant.findMany.mockResolvedValue(
        mockParticipants,
      );

      const result = await service.getMatchLeaderboard("match-1");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        rank: 1,
        address: "0xaddr1",
        pnl: "150",
        stakedAmount: "1000",
      });
      expect(result[0].roi).toBeDefined();
    });
  });
});

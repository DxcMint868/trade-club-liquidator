import { Test, TestingModule } from "@nestjs/testing";
import { GovernanceService } from "./governance.service";
import { DatabaseService } from "../database/database.service";
import { ContractService } from "../blockchain/contract.service";
import { GovernanceStatus } from "@prisma/client";

describe("GovernanceService", () => {
  let service: GovernanceService;
  let databaseService: DatabaseService;

  const mockDatabaseService = {
    governance: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    bribe: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    vote: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockContractService = {
    getProposal: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GovernanceService,
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

    service = module.get<GovernanceService>(GovernanceService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("handleBribeCreated", () => {
    it("should create a bribe record", async () => {
      const payload = {
        bribeId: "bribe-1",
        creator: "0xCreator",
        proposalId: "proposal-1",
        totalReward: "1000000000000000000",
        deadline: "1700086400",
        transactionHash: "0xBribeTx",
      };

      mockDatabaseService.bribe.create.mockResolvedValue({
        id: "bribe-1",
        ...payload,
      });

      await service.handleBribeCreated(payload);

      expect(mockDatabaseService.bribe.create).toHaveBeenCalledWith({
        data: {
          bribeId: "bribe-1",
          proposalId: "proposal-1",
          creator: "0xcreator",
          totalReward: "1000000000000000000",
          deadline: expect.any(Date),
          createdTxHash: "0xBribeTx",
        },
      });
    });
  });

  describe("handleVotesDelegated", () => {
    it("should record a vote delegation", async () => {
      const payload = {
        bribeId: "bribe-1",
        delegator: "0xDelegator",
        delegatee: "0xDelegatee",
        votes: "1000000000000000000",
        transactionHash: "0xVoteTx",
      };

      mockDatabaseService.vote.create.mockResolvedValue({
        id: "vote-1",
        ...payload,
      });

      await service.handleVotesDelegated(payload);

      expect(mockDatabaseService.vote.create).toHaveBeenCalledWith({
        data: {
          bribeId: "bribe-1",
          voter: "0xdelegator",
          delegatee: "0xdelegatee",
          voteWeight: "1000000000000000000",
          txHash: "0xVoteTx",
        },
      });
    });
  });

  describe("getAllProposals", () => {
    it("should return all proposals", async () => {
      const mockProposals = [
        {
          id: "proposal-1",
          status: GovernanceStatus.ACTIVE,
        },
        {
          id: "proposal-2",
          status: GovernanceStatus.ACTIVE,
        },
      ];

      mockDatabaseService.governance.findMany.mockResolvedValue(mockProposals);

      const result = await service.getAllProposals();

      expect(result).toEqual(mockProposals);
      expect(mockDatabaseService.governance.findMany).toHaveBeenCalled();
    });

    it("should filter by status", async () => {
      mockDatabaseService.governance.findMany.mockResolvedValue([]);

      await service.getAllProposals(GovernanceStatus.PASSED);

      expect(mockDatabaseService.governance.findMany).toHaveBeenCalledWith({
        where: { status: GovernanceStatus.PASSED },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("getBribeLeaderboard", () => {
    it("should return leaderboard sorted by vote weight", async () => {
      const mockVotes = [
        { delegatee: "0xdel1", voteWeight: "100", bribeId: "bribe-1" },
        { delegatee: "0xdel2", voteWeight: "200", bribeId: "bribe-1" },
        { delegatee: "0xdel1", voteWeight: "50", bribeId: "bribe-1" },
      ];

      mockDatabaseService.vote.findMany.mockResolvedValue(mockVotes);

      const result = await service.getBribeLeaderboard("bribe-1");

      expect(result).toHaveLength(2);
      expect(result[0].delegatee).toBe("0xdel2");
      expect(result[0].totalVotes).toBe("200");
      expect(result[1].delegatee).toBe("0xdel1");
      expect(result[1].totalVotes).toBe("150");
    });
  });

  describe("getUserGovernanceActivity", () => {
    it("should return user governance statistics", async () => {
      const mockVoterVotes = [
        { voteWeight: "1000000000000000000" },
        { voteWeight: "2000000000000000000" },
      ];

      const mockDelegateeVotes = [
        { voteWeight: "500000000000000000" },
        { voteWeight: "500000000000000000" },
      ];

      mockDatabaseService.vote.count.mockResolvedValue(2);
      mockDatabaseService.bribe.count.mockResolvedValue(1);
      mockDatabaseService.vote.findMany
        .mockResolvedValueOnce(mockVoterVotes) // As voter
        .mockResolvedValueOnce(mockDelegateeVotes); // As delegatee

      const result = await service.getUserGovernanceActivity("0xUser");

      expect(result.address).toBe("0xUser");
      expect(result.totalVotes).toBe(2);
      expect(result.bribesCreated).toBe(1);
      expect(result.totalVoteWeight).toBe("3000000000000000000");
      expect(result.receivedVoteWeight).toBe("1000000000000000000");
    });

    it("should handle user with no activity", async () => {
      mockDatabaseService.vote.count.mockResolvedValue(0);
      mockDatabaseService.bribe.count.mockResolvedValue(0);
      mockDatabaseService.vote.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getUserGovernanceActivity("0xUser");

      expect(result.address).toBe("0xUser");
      expect(result.totalVotes).toBe(0);
      expect(result.bribesCreated).toBe(0);
      expect(result.totalVoteWeight).toBe("0");
      expect(result.receivedVoteWeight).toBe("0");
    });
  });
});

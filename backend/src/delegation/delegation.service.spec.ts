import { Test, TestingModule } from "@nestjs/testing";
import { DelegationService } from "./delegation.service";
import { DatabaseService } from "../database/database.service";
import { ContractService } from "../blockchain/contract.service";
import { EventEmitter2 } from "@nestjs/event-emitter";

describe("DelegationService", () => {
  let service: DelegationService;
  let databaseService: DatabaseService;
  let contractService: ContractService;

  const mockDatabaseService = {
    delegation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockContractService = {
    isValidDelegation: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DelegationService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: ContractService,
          useValue: mockContractService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<DelegationService>(DelegationService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    contractService = module.get<ContractService>(ContractService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("handleDelegationCreated", () => {
    it("should create a delegation record", async () => {
      const payload = {
        delegationHash: "0x123",
        supporter: "0xSupporter",
        monachad: "0xMonachad",
        matchId: "match-1",
        amount: "1000000000000000000",
        spendingLimit: "500000000000000000",
        expiresAt: "1700000000",
        blockNumber: 12345,
        transactionHash: "0xTx123",
      };

      mockDatabaseService.delegation.create.mockResolvedValue({
        id: "delegation-1",
        ...payload,
      });

      await service.handleDelegationCreated(payload);

      expect(mockDatabaseService.delegation.create).toHaveBeenCalledWith({
        data: {
          delegationHash: "0x123",
          supporter: "0xsupporter",
          monachad: "0xmonachad",
          matchId: "match-1",
          amount: "1000000000000000000",
          spendingLimit: "500000000000000000",
          expiresAt: expect.any(Date),
          blockNumber: 12345,
          transactionHash: "0xTx123",
          isActive: true,
          createdTxHash: "0xTx123",
        },
      });
    });
  });

  describe("getUserDelegations", () => {
    it("should return delegations for a user", async () => {
      const mockDelegations = [
        {
          id: "1",
          delegationHash: "0x123",
          supporter: "0xsupporter",
          monachad: "0xmonachad",
          amount: "1000000000000000000",
          isActive: true,
        },
      ];

      mockDatabaseService.delegation.findMany.mockResolvedValue(
        mockDelegations,
      );

      const result = await service.getUserDelegations("0xSupporter");

      expect(result).toEqual(mockDelegations);
      expect(mockDatabaseService.delegation.findMany).toHaveBeenCalled();
    });
  });

  describe("getDelegationStats", () => {
    it("should calculate delegation statistics correctly", async () => {
      const mockDelegations = [
        { amount: "1000000000000000000", spent: "100000000000000000" },
        { amount: "2000000000000000000", spent: "200000000000000000" },
      ];

      mockDatabaseService.delegation.count.mockResolvedValue(2);
      mockDatabaseService.delegation.findMany
        .mockResolvedValueOnce(mockDelegations) // totalDelegatedAmount
        .mockResolvedValueOnce(mockDelegations) // totalReceivedAmount
        .mockResolvedValueOnce(mockDelegations); // totalSpentAmount

      const result = await service.getDelegationStats("0xMonachad");

      expect(result.asSupporterActive).toBe(2);
      expect(result.totalDelegatedAmount).toBeDefined();
    });

    it("should handle empty delegations", async () => {
      mockDatabaseService.delegation.count.mockResolvedValue(0);
      mockDatabaseService.delegation.findMany.mockResolvedValue([]);

      const result = await service.getDelegationStats("0xMonachad");

      expect(result.asSupporterActive).toBe(0);
    });
  });

  describe("isValidDelegation", () => {
    it("should validate delegation on-chain", async () => {
      mockContractService.isValidDelegation.mockResolvedValue(true);
      mockDatabaseService.delegation.findUnique.mockResolvedValue({
        id: "1",
        isActive: true,
        expiresAt: new Date(Date.now() + 10000),
      });

      const result = await service.isValidDelegation("0x123");

      expect(result).toBe(true);
    });
  });

  describe("handleDelegationRevoked", () => {
    it("should mark delegation as inactive", async () => {
      const payload = {
        delegationHash: "0x123",
        transactionHash: "0xRevokeTx",
      };

      mockDatabaseService.delegation.update.mockResolvedValue({
        id: "delegation-1",
        isActive: false,
      });

      await service.handleDelegationRevoked(payload);

      expect(mockDatabaseService.delegation.update).toHaveBeenCalledWith({
        where: { delegationHash: "0x123" },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
          revokedTxHash: "0xRevokeTx",
        },
      });
    });
  });
});

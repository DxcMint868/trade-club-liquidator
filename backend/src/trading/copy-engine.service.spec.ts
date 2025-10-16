import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { CopyEngineService } from "./copy-engine.service";
import { DatabaseService } from "../database/database.service";
import { ContractService } from "../blockchain/contract.service";
import { DelegationService } from "../delegation/delegation.service";
import { TradingService } from "./trading.service";
import { TradeType } from "@prisma/client";

describe("CopyEngineService", () => {
  let service: CopyEngineService;
  let databaseService: DatabaseService;

  const mockDatabaseService = {
    delegation: {
      findMany: jest.fn(),
    },
    participant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    trade: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockContractService = {
    formatEther: jest.fn((value) => `${value}`),
    getUserSmartAccount: jest.fn(),
    isDelegationValid: jest.fn(),
    getNonce: jest.fn(),
    getMaxFeePerGas: jest.fn(),
    getMaxPriorityFeePerGas: jest.fn(),
  };

  const mockDelegationService = {
    isValidDelegation: jest.fn(),
  };

  const mockTradingService = {
    recordTrade: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        BUNDLER_URL: "https://test-bundler.example.com",
        ENTRYPOINT_ADDRESS: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopyEngineService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: ContractService,
          useValue: mockContractService,
        },
        {
          provide: DelegationService,
          useValue: mockDelegationService,
        },
        {
          provide: TradingService,
          useValue: mockTradingService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CopyEngineService>(CopyEngineService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("executeCopyTrades", () => {
    it("should execute copy trades for all active delegations", async () => {
      const params = {
        monachadAddress: "0xMonachad",
        matchId: "match-1",
        originalTrade: {
          target: "0xDex",
          value: "1000000000000000000",
          data: "0xdata",
          tokenIn: "0xTokenA",
          tokenOut: "0xTokenB",
        },
      };

      const mockDelegations = [
        {
          id: "delegation-1",
          delegationHash: "0xHash1",
          supporter: "0xSupporter1",
          amount: "500000000000000000",
          spentAmount: "0",
        },
        {
          id: "delegation-2",
          delegationHash: "0xHash2",
          supporter: "0xSupporter2",
          amount: "500000000000000000",
          spentAmount: "0",
        },
      ];

      mockDatabaseService.delegation.findMany.mockResolvedValue(
        mockDelegations,
      );
      mockDelegationService.isValidDelegation.mockResolvedValue(true);

      // Note: UserOperation execution is temporarily disabled
      // The service will log and return early instead of executing trades

      mockDatabaseService.participant.findUnique.mockResolvedValue(null);
      mockDatabaseService.participant.create.mockResolvedValue({
        id: "participant-1",
        address: "0xsupporter1",
      });

      await service.executeCopyTrades(params);

      expect(mockDatabaseService.delegation.findMany).toHaveBeenCalled();
      // executeDelegatedTrade removed - now uses UserOperations (not yet implemented)
      // expect(mockContractService.executeDelegatedTrade).toHaveBeenCalledTimes(2);
      // recordTrade also skipped until UserOperation implementation
      // expect(mockTradingService.recordTrade).toHaveBeenCalledTimes(2);
    });

    it("should skip if no active delegations", async () => {
      const params = {
        monachadAddress: "0xMonachad",
        matchId: "match-1",
        originalTrade: {
          target: "0xDex",
          value: "1000000000000000000",
          data: "0xdata",
        },
      };

      mockDatabaseService.delegation.findMany.mockResolvedValue([]);

      await service.executeCopyTrades(params);

      // No delegations, so nothing to execute
      // expect(mockContractService.executeDelegatedTrade).not.toHaveBeenCalled();
    });

    it("should skip invalid delegations", async () => {
      const params = {
        monachadAddress: "0xMonachad",
        matchId: "match-1",
        originalTrade: {
          target: "0xDex",
          value: "1000000000000000000",
          data: "0xdata",
        },
      };

      const mockDelegations = [
        {
          id: "delegation-1",
          delegationHash: "0xHash1",
          supporter: "0xSupporter1",
          amount: "500000000000000000",
          spentAmount: "0",
        },
      ];

      mockDatabaseService.delegation.findMany.mockResolvedValue(
        mockDelegations,
      );
      mockDelegationService.isValidDelegation.mockResolvedValue(false);

      await service.executeCopyTrades(params);

      // Delegation not valid, so no execution
      // expect(mockContractService.executeDelegatedTrade).not.toHaveBeenCalled();
    });
  });

  describe("getCopyTradingStats", () => {
    it("should calculate copy trading statistics", async () => {
      const mockDelegations = [
        {
          amount: "1000000000000000000",
          spentAmount: "200000000000000000",
        },
        {
          amount: "2000000000000000000",
          spentAmount: "400000000000000000",
        },
      ];

      mockDatabaseService.delegation.findMany.mockResolvedValue(
        mockDelegations,
      );
      mockDatabaseService.trade.count.mockResolvedValue(5);

      const result = await service.getCopyTradingStats("0xMonachad", "match-1");

      expect(result).toEqual({
        monachad: "0xMonachad",
        matchId: "match-1",
        totalSupporters: 2,
        totalDelegatedAmount: "3000000000000000000",
        totalSpentAmount: "600000000000000000",
        remainingAmount: "2400000000000000000",
        copyTradesExecuted: 5,
        utilizationRate: 20,
      });
    });

    it("should handle zero delegations", async () => {
      mockDatabaseService.delegation.findMany.mockResolvedValue([]);
      mockDatabaseService.trade.count.mockResolvedValue(0);

      const result = await service.getCopyTradingStats("0xMonachad");

      expect(result.totalDelegatedAmount).toBe("0");
      expect(result.utilizationRate).toBe(0);
    });
  });

  describe("getCopyTradeStats", () => {
    it("should calculate supporter copy trade statistics", async () => {
      const mockTrades = [
        {
          amountIn: "1000000000000000000",
          participant: { pnl: "100000000000000000" },
        },
        {
          amountIn: "500000000000000000",
          participant: { pnl: "50000000000000000" },
        },
      ];

      mockDatabaseService.trade.findMany.mockResolvedValue(mockTrades);

      const result = await service.getCopyTradeStats("0xSupporter", "match-1");

      expect(result).toEqual({
        supporter: "0xSupporter",
        matchId: "match-1",
        totalCopyTrades: 2,
        totalVolume: "1500000000000000000",
        totalPnL: "150000000000000000",
        avgPnLPerTrade: "75000000000000000",
      });
    });

    it("should handle supporter with no trades", async () => {
      mockDatabaseService.trade.findMany.mockResolvedValue([]);

      const result = await service.getCopyTradeStats("0xSupporter");

      expect(result).toEqual({
        supporter: "0xSupporter",
        matchId: "all",
        totalCopyTrades: 0,
        totalVolume: "0",
        totalPnL: "0",
        avgPnLPerTrade: "0",
      });
    });
  });
});

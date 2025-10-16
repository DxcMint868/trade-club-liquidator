import { Test, TestingModule } from "@nestjs/testing";
import { TradingService } from "./trading.service";
import { DatabaseService } from "../database/database.service";
import { ContractService } from "../blockchain/contract.service";
import { TradeType } from "@prisma/client";

describe("TradingService", () => {
  let service: TradingService;
  let databaseService: DatabaseService;

  const mockDatabaseService = {
    trade: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockContractService = {
    executeTrade: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradingService,
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

    service = module.get<TradingService>(TradingService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("recordTrade", () => {
    it("should create a trade record", async () => {
      const dto = {
        matchId: "match-1",
        participantId: "participant-1",
        delegationId: null,
        tradeType: TradeType.MONACHAD_TRADE,
        tokenIn: "0xTokenA",
        tokenOut: "0xTokenB",
        amountIn: "1000000000000000000",
        amountOut: "2000000000000000000",
        targetContract: "0xDex",
      };

      const mockTrade = {
        id: "trade-1",
        ...dto,
        blockNumber: 12345,
        transactionHash: "0xTradeTx",
      };

      mockDatabaseService.trade.create.mockResolvedValue(mockTrade);

      const result = await service.recordTrade(dto, 12345, "0xTradeTx");

      expect(result).toEqual(mockTrade);
      expect(mockDatabaseService.trade.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          blockNumber: 12345,
          transactionHash: "0xTradeTx",
        },
      });
    });
  });

  describe("getTradesByMatch", () => {
    it("should return all trades for a match", async () => {
      const mockTrades = [
        {
          id: "trade-1",
          matchId: "match-1",
          tradeType: TradeType.MONACHAD_TRADE,
        },
        {
          id: "trade-2",
          matchId: "match-1",
          tradeType: TradeType.SUPPORTER_COPY,
        },
      ];

      mockDatabaseService.trade.findMany.mockResolvedValue(mockTrades);

      const result = await service.getTradesByMatch("match-1");

      expect(result).toEqual(mockTrades);
      expect(mockDatabaseService.trade.findMany).toHaveBeenCalledWith({
        where: { matchId: "match-1" },
        orderBy: {
          timestamp: "desc",
        },
      });
    });
  });

  describe("getTradesByTrader", () => {
    it("should return trades for a specific trader", async () => {
      const mockTrades = [
        {
          id: "trade-1",
          participant: {
            address: "0xtrader",
            pnl: "1000",
          },
        },
      ];

      mockDatabaseService.trade.findMany.mockResolvedValue(mockTrades);

      const result = await service.getTradesByTrader("0xTrader");

      expect(result).toEqual(mockTrades);
      expect(mockDatabaseService.trade.findMany).toHaveBeenCalledWith({
        where: {
          participant: {
            address: "0xtrader",
          },
        },
        include: {
          participant: true,
        },
        orderBy: {
          timestamp: "desc",
        },
      });
    });
  });

  describe("getTradingStats", () => {
    it("should calculate trading statistics", async () => {
      const mockTrades = [
        {
          amountIn: "1000000000000000000",
          participant: { pnl: "100000000000000000" },
        },
        {
          amountIn: "2000000000000000000",
          participant: { pnl: "200000000000000000" },
        },
      ];

      mockDatabaseService.trade.findMany.mockResolvedValue(mockTrades);

      const result = await service.getTradingStats("0xTrader", "match-1");

      expect(result).toEqual({
        trader: "0xTrader",
        matchId: "match-1",
        totalTrades: 2,
        totalVolume: "3000000000000000000",
        totalPnL: "300000000000000000",
        avgTradeSize: "1500000000000000000",
      });
    });

    it("should handle empty trades", async () => {
      mockDatabaseService.trade.findMany.mockResolvedValue([]);

      const result = await service.getTradingStats("0xTrader");

      expect(result).toEqual({
        trader: "0xTrader",
        matchId: "all",
        totalTrades: 0,
        totalVolume: "0",
        totalPnL: "0",
        avgTradeSize: "0",
      });
    });
  });

  describe("getTradeHistory", () => {
    it("should return trade history for a trader in a match", async () => {
      const mockTrades = [
        {
          id: "trade-1",
          matchId: "match-1",
          participant: { address: "0xtrader" },
        },
      ];

      mockDatabaseService.trade.findMany.mockResolvedValue(mockTrades);

      const result = await service.getTradeHistory("match-1", "0xTrader");

      expect(result).toEqual(mockTrades);
      expect(mockDatabaseService.trade.findMany).toHaveBeenCalledWith({
        where: {
          matchId: "match-1",
          participant: {
            address: "0xtrader",
          },
        },
        include: {
          participant: true,
        },
        orderBy: {
          timestamp: "desc",
        },
      });
    });
  });
});

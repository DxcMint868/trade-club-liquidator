import { parseAbiItem } from "viem";

export const FUNDEX_ABI = [
  {
    type: "function",
    name: "openPosition",
    stateMutability: "payable",
    inputs: [
      { name: "assetId", type: "uint256" },
      { name: "positionType", type: "uint8" },
      { name: "leverage", type: "uint256" },
    ],
    outputs: [{ name: "positionId", type: "uint256" }],
  },
  {
    type: "function",
    name: "closePosition",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "assetId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getUserOpenPositions",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "positionIds", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [
      {
        components: [
          { name: "trader", type: "address" },
          { name: "positionType", type: "uint8" },
          { name: "collateral", type: "uint256" },
          { name: "size", type: "uint256" },
          { name: "leverage", type: "uint256" },
          { name: "entryPrice", type: "uint256" },
          { name: "openedAt", type: "uint256" },
          { name: "isOpen", type: "bool" },
        ],
        name: "position",
        type: "tuple",
      },
    ],
  },
  {
    type: "function",
    name: "assets",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "symbol", type: "string" },
      { name: "currentPrice", type: "uint256" },
      { name: "lastUpdated", type: "uint256" },
      { name: "isActive", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getAsset",
    stateMutability: "view",
    inputs: [{ name: "assetId", type: "uint256" }],
    outputs: [
      {
        components: [
          { name: "symbol", type: "string" },
          { name: "currentPrice", type: "uint256" },
          { name: "lastUpdated", type: "uint256" },
          { name: "isActive", type: "bool" },
        ],
        name: "",
        type: "tuple",
      },
    ],
  },
  {
    type: "event",
    name: "PositionOpened",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "assetId", type: "uint256", indexed: true },
      { name: "positionType", type: "uint8" },
      { name: "collateral", type: "uint256" },
      { name: "size", type: "uint256" },
      { name: "leverage", type: "uint256" },
      { name: "entryPrice", type: "uint256" },
      { name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "PositionClosed",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "assetId", type: "uint256", indexed: true },
      { name: "exitPrice", type: "uint256" },
      { name: "pnl", type: "int256" },
      { name: "timestamp", type: "uint256" },
    ],
  },
] as const;

export const POSITION_OPENED_EVENT = parseAbiItem(
  "event PositionOpened(uint256 indexed positionId, address indexed trader, uint256 indexed assetId, uint8 positionType, uint256 collateral, uint256 size, uint256 leverage, uint256 entryPrice, uint256 timestamp)"
);

export const POSITION_CLOSED_EVENT = parseAbiItem(
  "event PositionClosed(uint256 indexed positionId, address indexed trader, uint256 indexed assetId, uint256 exitPrice, int256 pnl, uint256 timestamp)"
);

export type PositionTypeLabel = "LONG" | "SHORT";

export const POSITION_TYPE_LABELS: Record<number, PositionTypeLabel> = {
  0: "LONG",
  1: "SHORT",
};

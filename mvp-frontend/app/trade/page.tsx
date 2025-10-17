"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { type Hex, parseEther, formatEther } from "viem";

interface Asset {
  id: number;
  symbol: string;
  currentPrice: bigint;
  lastUpdated: bigint;
  isActive: boolean;
}

interface Position {
  id: number;
  trader: string;
  positionType: number; // 0 = LONG, 1 = SHORT
  collateral: bigint;
  size: bigint;
  leverage: bigint;
  entryPrice: bigint;
  openedAt: bigint;
  isOpen: boolean;
}

export default function TradePage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [balance, setBalance] = useState<string>("0");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<number>(1);
  const [positionType, setPositionType] = useState<number>(0); // 0 = LONG, 1 = SHORT
  const [collateral, setCollateral] = useState<string>("0.01");
  const [leverage, setLeverage] = useState<string>("2");
  const [depositAmount, setDepositAmount] = useState<string>("0.1");
  const [isLoading, setIsLoading] = useState(false);

  const fundexAddress = process.env.NEXT_PUBLIC_FUNDEX_ADDRESS as Hex;

  const FUNDEX_ABI = [
    {
      inputs: [],
      name: "deposit",
      outputs: [],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
      name: "withdraw",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "uint256", name: "assetId", type: "uint256" },
        {
          internalType: "enum FUNDex.PositionType",
          name: "positionType",
          type: "uint8",
        },
        { internalType: "uint256", name: "leverage", type: "uint256" },
      ],
      name: "openPosition",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "uint256", name: "positionId", type: "uint256" },
        { internalType: "uint256", name: "assetId", type: "uint256" },
      ],
      name: "closePosition",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "", type: "address" }],
      name: "balances",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "assetId", type: "uint256" }],
      name: "getAsset",
      outputs: [
        {
          components: [
            { internalType: "string", name: "symbol", type: "string" },
            { internalType: "uint256", name: "currentPrice", type: "uint256" },
            { internalType: "uint256", name: "lastUpdated", type: "uint256" },
            { internalType: "bool", name: "isActive", type: "bool" },
          ],
          internalType: "struct FUNDex.Asset",
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "user", type: "address" }],
      name: "getUserOpenPositions",
      outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "positionId", type: "uint256" }],
      name: "getPosition",
      outputs: [
        {
          components: [
            { internalType: "address", name: "trader", type: "address" },
            {
              internalType: "enum FUNDex.PositionType",
              name: "positionType",
              type: "uint8",
            },
            { internalType: "uint256", name: "collateral", type: "uint256" },
            { internalType: "uint256", name: "size", type: "uint256" },
            { internalType: "uint256", name: "leverage", type: "uint256" },
            { internalType: "uint256", name: "entryPrice", type: "uint256" },
            { internalType: "uint256", name: "openedAt", type: "uint256" },
            { internalType: "bool", name: "isOpen", type: "bool" },
          ],
          internalType: "struct FUNDex.Position",
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        { internalType: "uint256", name: "positionId", type: "uint256" },
        { internalType: "uint256", name: "currentPrice", type: "uint256" },
      ],
      name: "calculatePnL",
      outputs: [{ internalType: "int256", name: "", type: "int256" }],
      stateMutability: "view",
      type: "function",
    },
  ];

  useEffect(() => {
    if (address && isConnected) {
      loadData();
    }
  }, [address, isConnected]);

  const loadData = async () => {
    if (!publicClient || !address) return;

    try {
      // Load balance
      const bal = (await publicClient.readContract({
        address: fundexAddress,
        abi: FUNDEX_ABI,
        functionName: "balances",
        args: [address],
      })) as bigint;

      setBalance(formatEther(bal));

      // Load asset 1 (ETH/USD)
      const asset = (await publicClient.readContract({
        address: fundexAddress,
        abi: FUNDEX_ABI,
        functionName: "getAsset",
        args: [BigInt(1)],
      })) as any;

      setAssets([{ id: 1, symbol: asset[0], currentPrice: asset[1], lastUpdated: asset[2], isActive: asset[3] }]);

      // Load open positions
      const positionIds = (await publicClient.readContract({
        address: fundexAddress,
        abi: FUNDEX_ABI,
        functionName: "getUserOpenPositions",
        args: [address],
      })) as bigint[];

      const positionsData = await Promise.all(
        positionIds.map(async (posId) => {
          const pos = (await publicClient.readContract({
            address: fundexAddress,
            abi: FUNDEX_ABI,
            functionName: "getPosition",
            args: [posId],
          })) as any;

          return {
            id: Number(posId),
            trader: pos[0],
            positionType: pos[1],
            collateral: pos[2],
            size: pos[3],
            leverage: pos[4],
            entryPrice: pos[5],
            openedAt: pos[6],
            isOpen: pos[7],
          };
        })
      );

      setPositions(positionsData);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  };

  const handleDeposit = async () => {
    if (!walletClient || !publicClient || !address) {
      alert("Please connect wallet");
      return;
    }

    setIsLoading(true);
    try {
      const amount = parseEther(depositAmount);

      const hash = await walletClient.writeContract({
        address: fundexAddress,
        abi: FUNDEX_ABI,
        functionName: "deposit",
        value: amount,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      alert("Deposited successfully!");
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPosition = async () => {
    if (!walletClient || !publicClient || !address) {
      alert("Please connect wallet");
      return;
    }

    setIsLoading(true);
    try {
      const collateralAmount = parseEther(collateral);
      const leverageNum = BigInt(leverage);

      const hash = await walletClient.writeContract({
        address: fundexAddress,
        abi: FUNDEX_ABI,
        functionName: "openPosition",
        args: [BigInt(selectedAsset), positionType, leverageNum],
        value: collateralAmount, // Send ETH directly in this transaction
      });

      await publicClient.waitForTransactionReceipt({ hash });
      alert("Position opened successfully!");
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClosePosition = async (positionId: number) => {
    if (!walletClient || !publicClient) {
      alert("Please connect wallet");
      return;
    }

    setIsLoading(true);
    try {
      const hash = await walletClient.writeContract({
        address: fundexAddress,
        abi: FUNDEX_ABI,
        functionName: "closePosition",
        args: [BigInt(positionId), BigInt(selectedAsset)],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      alert("Position closed successfully!");
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateUnrealizedPnL = async (position: Position) => {
    if (!publicClient) return "0";

    try {
      const asset = assets.find((a) => a.id === selectedAsset);
      if (!asset) return "0";

      const pnl = (await publicClient.readContract({
        address: fundexAddress,
        abi: FUNDEX_ABI,
        functionName: "calculatePnL",
        args: [BigInt(position.id), asset.currentPrice],
      })) as bigint;

      return formatEther(pnl);
    } catch (err) {
      return "0";
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/matches" className="text-blue-500 hover:text-blue-400">
            ← Back to Matches
          </Link>
          <ConnectButton />
        </div>

        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-4xl font-bold">FUNDex Trading</h1>
          <span className="text-4xl">😄</span>
        </div>

        {!isConnected ? (
          <div className="card">
            <p className="text-gray-400 mb-4">Connect wallet to start trading</p>
            <ConnectButton />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: Account & Deposit */}
            <div className="lg:col-span-1 space-y-6">
              {/* Balance */}
              <div className="card">
                <h3 className="text-xl font-bold mb-4">Your Balance</h3>
                <p className="text-3xl font-bold text-green-400">{balance} ETH</p>
                <p className="text-sm text-gray-500 mt-1">Available for trading</p>
              </div>

              {/* Deposit */}
              <div className="card">
                <h3 className="text-xl font-bold mb-4">Deposit ETH</h3>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white mb-3"
                  placeholder="Amount to deposit"
                />
                <button
                  onClick={handleDeposit}
                  disabled={isLoading || parseFloat(depositAmount) <= 0}
                  className="btn btn-primary w-full disabled:opacity-50"
                >
                  {isLoading ? "Processing..." : "Deposit"}
                </button>
              </div>

              {/* Market Info */}
              <div className="card">
                <h3 className="text-xl font-bold mb-4">Market</h3>
                {assets.map((asset) => (
                  <div key={asset.id} className="mb-3">
                    <p className="text-sm text-gray-500">{asset.symbol}</p>
                    <p className="text-2xl font-bold">
                      ${(Number(asset.currentPrice) / 1e18).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Middle: Open Position */}
            <div className="lg:col-span-1">
              <div className="card">
                <h3 className="text-xl font-bold mb-4">Open Position</h3>

                {/* Position Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Direction
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPositionType(0)}
                      className={`py-3 rounded-lg font-semibold transition-all ${
                        positionType === 0
                          ? "bg-green-600 text-white"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}
                    >
                      LONG
                    </button>
                    <button
                      onClick={() => setPositionType(1)}
                      className={`py-3 rounded-lg font-semibold transition-all ${
                        positionType === 1
                          ? "bg-red-600 text-white"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}
                    >
                      SHORT
                    </button>
                  </div>
                </div>

                {/* Collateral */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Collateral (ETH)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={collateral}
                    onChange={(e) => setCollateral(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                  />
                </div>

                {/* Leverage */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Leverage: {leverage}x
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={leverage}
                    onChange={(e) => setLeverage(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Position Size */}
                <div className="bg-gray-800/50 p-3 rounded-lg mb-4">
                  <p className="text-sm text-gray-500">Position Size</p>
                  <p className="text-xl font-bold">
                    {(parseFloat(collateral) * parseFloat(leverage)).toFixed(4)} ETH
                  </p>
                </div>

                <button
                  onClick={handleOpenPosition}
                  disabled={isLoading || parseFloat(collateral) <= 0}
                  className="btn btn-primary w-full disabled:opacity-50"
                >
                  {isLoading ? "Processing..." : "Open Position"}
                </button>
              </div>
            </div>

            {/* Right: Open Positions */}
            <div className="lg:col-span-1">
              <div className="card">
                <h3 className="text-xl font-bold mb-4">Your Positions</h3>

                {positions.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No open positions</p>
                ) : (
                  <div className="space-y-4">
                    {positions.map((position) => (
                      <div
                        key={position.id}
                        className="bg-gray-800/50 p-4 rounded-lg border border-gray-700"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span
                              className={`px-2 py-1 rounded text-xs font-bold ${
                                position.positionType === 0
                                  ? "bg-green-600"
                                  : "bg-red-600"
                              }`}
                            >
                              {position.positionType === 0 ? "LONG" : "SHORT"}
                            </span>
                            <p className="text-sm text-gray-500 mt-1">
                              {leverage}x Leverage
                            </p>
                          </div>
                          <p className="text-sm text-gray-500">#{position.id}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                          <div>
                            <p className="text-gray-500">Collateral</p>
                            <p className="font-semibold">
                              {formatEther(position.collateral)} ETH
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Size</p>
                            <p className="font-semibold">
                              {formatEther(position.size)} ETH
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Entry Price</p>
                            <p className="font-semibold">
                              ${(Number(position.entryPrice) / 1e18).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Current Price</p>
                            <p className="font-semibold">
                              $
                              {assets[0]
                                ? (Number(assets[0].currentPrice) / 1e18).toFixed(2)
                                : "0"}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleClosePosition(position.id)}
                          disabled={isLoading}
                          className="btn bg-red-600 hover:bg-red-700 w-full text-sm disabled:opacity-50"
                        >
                          Close Position
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

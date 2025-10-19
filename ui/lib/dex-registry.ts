export interface DexInfo {
  id: string;
  name: string;
  address: string;
  icon: string;
  description: string;
  isActive: boolean;
  chainId: number;
}

export const DEX_REGISTRY: Record<string, DexInfo> = {
  fundex: {
    id: "fundex",
    name: "FUNDex",
    address: process.env.NEXT_PUBLIC_FUNDEX_ADDRESS || "",
    icon: "😄", // Smiling face
    description: "Demo perpetuals DEX with simulated price feeds",
    isActive: true,
    chainId: 84532, // Base Sepolia
  },
  // Add real DEXs here as needed
  uniswap: {
    id: "uniswap",
    name: "Uniswap V3",
    address: "0x...", // Add actual address
    icon: "🦄",
    description: "Decentralized exchange protocol",
    isActive: false, // Enable when integrated
    chainId: 84532,
  },
  // More DEXs...
};

export function getActiveDexes(): DexInfo[] {
  return Object.values(DEX_REGISTRY).filter(dex => dex.isActive);
}

export function getDexByAddress(address: string): DexInfo | undefined {
  return Object.values(DEX_REGISTRY).find(
    dex => dex.address.toLowerCase() === address.toLowerCase()
  );
}

export function getDexById(id: string): DexInfo | undefined {
  return DEX_REGISTRY[id];
}

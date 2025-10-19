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
    icon: "https://ih1.redbubble.net/image.2921775853.6552/tst,small,507x507-pad,600x600,f8f8f8.jpg",
    description: "Demo perpetuals DEX with simulated price feeds",
    isActive: true,
    chainId: 84532, // Base Sepolia
  },
  // Add real DEXs here as needed
  uniswap: {
    id: "uniswap",
    name: "Uniswap V3",
    address: "0x...", // Add actual address
    icon: "https://png.pngtree.com/png-clipart/20230820/original/pngtree-uniswap-uni-token-symbol-cryptocurrency-logo-picture-image_8077633.png",
    description: "Decentralized exchange protocol",
    isActive: true, // Enable when integrated
    chainId: 84532,
  },
  pancakeSwap: {
    id: "pancakeSwap",
    name: "PancakeSwap",
    address: "0x...", // Add actual address
    icon: "https://png.pngtree.com/png-clipart/20230817/original/pngtree-cryptocurrency-icon-of-pancakeswap-cake-token-symbol-isolated-on-a-white-background-representing-digital-currency-vector-picture-image_10938358.png",
    description: "Popular DEX on Binance Smart Chain",
    isActive: true, // Enable when integrated
    chainId: 56,
  },
  sushiswap: {
    id: "sushiswap",
    name: "SushiSwap",
    address: "0x...", // Add actual address
    icon: "https://images.seeklogo.com/logo-png/44/2/sushiswap-sushi-logo-png_seeklogo-444500.png", // TODO: Replace with actual logo URL
    description: "Community-driven DEX",
    isActive: true, // Enable when integrated
    chainId: 84532,
  },
};

export function getActiveDexes(): DexInfo[] {
  return Object.values(DEX_REGISTRY).filter((dex) => dex.isActive);
}

export function getDexByAddress(address: string): DexInfo | undefined {
  return Object.values(DEX_REGISTRY).find(
    (dex) => dex.address.toLowerCase() === address.toLowerCase()
  );
}

export function getDexById(id: string): DexInfo | undefined {
  return DEX_REGISTRY[id];
}

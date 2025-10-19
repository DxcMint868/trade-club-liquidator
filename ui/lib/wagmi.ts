import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, baseSepolia, monadTestnet } from 'viem/chains';

export const config = getDefaultConfig({
  appName: 'TradeClub MVP',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [sepolia, baseSepolia, monadTestnet],
  ssr: true,
});

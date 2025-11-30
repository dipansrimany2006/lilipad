export const sidebarLinks = [
  {
    name: "Home",
    href: "/",
    icon: "Flower",
  },
  {
    name: " Fair Launch",
    href: "/launch",
    icon: "Rocket",
  },
  {
    name: "Portfolio",
    href: "/portfolio",
    icon: "PieChart",
  },
  {
    name: "Trade",
    href: "/trade",
    icon: "ArrowLeftRight",
  },
  {
    name:"Tokens",
    href:"/tokens",
    icon:"CirclePoundSterling",
  },
  {
    name: "Locks",
    href: "/locks",
    icon: "Lock",
  },
  {
    name: "Vesting",
    href: "/vesting",
    icon: "Droplets",
  },
  {
    name: "Vault",
    href: "/vault",
    icon: "Vault",
  },
];


import type { Network } from "@aptos-labs/wallet-adapter-react";

export const NETWORK: Network = (process.env.NEXT_PUBLIC_APP_NETWORK as Network) ?? "testnet";
export const MODULE_ADDRESS = process.env.NEXT_PUBLIC_MODULE_ADDRESS;
export const APTOS_API_KEY = process.env.NEXT_PUBLIC_APTOS_API_KEY;

// DEX Provider Configuration
export type DexProvider = "hyperion" | "liquidswap";

export const DEFAULT_DEX_PROVIDER: DexProvider =
  (process.env.NEXT_PUBLIC_DEFAULT_DEX as DexProvider) ?? "hyperion";

export const DEX_PROVIDER_INFO = {
  hyperion: {
    name: "Hyperion",
    description: "Concentrated liquidity DEX with advanced routing",
    icon: "/image/hyperion.png",
    features: ["Concentrated Liquidity", "Smart Routing", "Multiple Fee Tiers"],
  },
  liquidswap: {
    name: "LiquidSwap",
    description: "Classic AMM with stable and uncorrelated pools",
    icon: "/image/liquidswap.png",
    features: ["Stable Pools", "Low Slippage", "Simple Interface"],
  },
} as const;

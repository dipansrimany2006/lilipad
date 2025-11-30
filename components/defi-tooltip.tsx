"use client";

import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// DeFi terminology definitions
export const DEFI_TERMS: Record<string, { title: string; description: string }> = {
  softCap: {
    title: "Soft Cap",
    description: "The minimum amount of funds that must be raised for the sale to be considered successful. If the soft cap isn't reached, buyers may be eligible for refunds.",
  },
  hardCap: {
    title: "Hard Cap",
    description: "The maximum amount of funds that can be raised. Once reached, no more purchases are accepted.",
  },
  vesting: {
    title: "Vesting",
    description: "A mechanism that releases tokens gradually over time instead of all at once. This prevents large immediate sell-offs and ensures long-term commitment.",
  },
  linearVesting: {
    title: "Linear Vesting",
    description: "Tokens unlock at a steady rate over time. For example, if you have 1000 tokens vesting over 100 days, you can claim 10 tokens each day.",
  },
  escrow: {
    title: "Escrow",
    description: "Tokens or funds held by a smart contract until certain conditions are met. Ensures safety for both buyers and sellers.",
  },
  fairLaunch: {
    title: "Fair Launch",
    description: "A token sale where everyone has equal opportunity to participate. No pre-allocations, VC rounds, or insider advantages.",
  },
  lpTokens: {
    title: "LP Tokens",
    description: "Liquidity Provider tokens received when you add liquidity to a DEX. They represent your share of the liquidity pool.",
  },
  liquidity: {
    title: "Liquidity",
    description: "The ability to buy or sell an asset without causing significant price impact. Higher liquidity means easier trading.",
  },
  dex: {
    title: "DEX",
    description: "Decentralized Exchange - A trading platform that operates without a central authority, using smart contracts for trades.",
  },
  slippage: {
    title: "Slippage",
    description: "The difference between expected price and actual execution price. Higher slippage occurs in low-liquidity markets.",
  },
  apy: {
    title: "APY",
    description: "Annual Percentage Yield - The real rate of return earned on an investment, taking compound interest into account.",
  },
  apr: {
    title: "APR",
    description: "Annual Percentage Rate - Simple interest rate without compounding. APY is typically higher than APR for the same investment.",
  },
  tvl: {
    title: "TVL",
    description: "Total Value Locked - The total value of assets deposited in a DeFi protocol. A key metric for measuring protocol adoption.",
  },
  staking: {
    title: "Staking",
    description: "Locking up tokens to support network operations (like validating transactions) in exchange for rewards.",
  },
  impermanentLoss: {
    title: "Impermanent Loss",
    description: "Potential loss when providing liquidity to a pool. Occurs when token prices change compared to when you deposited.",
  },
  tokenomics: {
    title: "Tokenomics",
    description: "The economics of a token - including supply, distribution, utility, and incentive mechanisms.",
  },
  pricePerToken: {
    title: "Price per Token",
    description: "The cost in APT to purchase one token during the sale. Final price may differ after trading begins on DEXs.",
  },
  vestingPeriod: {
    title: "Vesting Period",
    description: "The duration over which purchased tokens are gradually released. Longer periods indicate stronger long-term commitment.",
  },
  claimable: {
    title: "Claimable",
    description: "Tokens that have vested and are available to withdraw to your wallet right now.",
  },
  lock: {
    title: "Token Lock",
    description: "Tokens locked in a smart contract until a specific date. Often used by teams to show commitment.",
  },
};

interface DefiTooltipProps {
  term: keyof typeof DEFI_TERMS;
  children?: React.ReactNode;
  showIcon?: boolean;
  className?: string;
}

export function DefiTooltip({ term, children, showIcon = true, className = "" }: DefiTooltipProps) {
  const termInfo = DEFI_TERMS[term];

  if (!termInfo) {
    return <>{children}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 cursor-help ${className}`}>
          {children}
          {showIcon && (
            <HelpCircle className="h-3.5 w-3.5 text-gray-500 hover:text-[#D4F6D3] transition-colors" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent
        className="max-w-xs bg-[#0B1418] border border-[#D4F6D3]/30 text-white p-3 shadow-xl"
        sideOffset={5}
      >
        <div className="space-y-1">
          <p className="font-medium text-[#D4F6D3] text-sm">{termInfo.title}</p>
          <p className="text-gray-300 text-xs leading-relaxed">{termInfo.description}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Inline tooltip for text within paragraphs
interface InlineTermProps {
  term: keyof typeof DEFI_TERMS;
  className?: string;
}

export function InlineTerm({ term, className = "" }: InlineTermProps) {
  const termInfo = DEFI_TERMS[term];

  if (!termInfo) {
    return <span>{term}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`border-b border-dotted border-[#D4F6D3]/50 cursor-help hover:text-[#D4F6D3] transition-colors ${className}`}>
          {termInfo.title}
        </span>
      </TooltipTrigger>
      <TooltipContent
        className="max-w-xs bg-[#0B1418] border border-[#D4F6D3]/30 text-white p-3 shadow-xl"
        sideOffset={5}
      >
        <p className="text-gray-300 text-xs leading-relaxed">{termInfo.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// DexScreener API Client for Aptos

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
}

export interface TransactionStats {
  buys: number;
  sells: number;
}

export interface PairData {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: TokenInfo;
  quoteToken: TokenInfo;
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: TransactionStats;
    h1: TransactionStats;
    h6: TransactionStats;
    h24: TransactionStats;
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  info?: {
    imageUrl?: string;
    header?: string;
    openGraph?: string;
    websites?: Array<{ url: string; label: string }>;
    socials?: Array<{ url: string; type: string }>;
  };
}

const DEXSCREENER_API_BASE = "https://api.dexscreener.com";

/**
 * Fetch token pairs from DexScreener for a specific token on Aptos
 */
export async function getTokenPairs(tokenAddress: string): Promise<PairData[]> {
  try {
    const response = await fetch(
      `${DEXSCREENER_API_BASE}/token-pairs/v1/aptos/${tokenAddress}`,
      {
        method: "GET",
        headers: {
          Accept: "*/*",
        },
      }
    );

    if (!response.ok) {
      console.error("DexScreener API error:", response.status);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch token pairs:", error);
    return [];
  }
}

/**
 * Get the best pair (highest liquidity) for a token
 */
export async function getBestPair(tokenAddress: string): Promise<PairData | null> {
  const pairs = await getTokenPairs(tokenAddress);
  if (pairs.length === 0) return null;

  // Sort by liquidity USD and return the highest
  return pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
}

/**
 * Get DexScreener embed chart URL for a pair
 */
export function getChartEmbedUrl(pairAddress: string): string {
  return `https://dexscreener.com/aptos/${pairAddress}?embed=1&theme=dark&trades=0&info=0`;
}

/**
 * Get DexScreener page URL for a pair
 */
export function getPairUrl(pairAddress: string): string {
  return `https://dexscreener.com/aptos/${pairAddress}`;
}

/**
 * Format price change with color indicator
 */
export function formatPriceChange(change: number | undefined | null): { value: string; color: string } {
  if (change === undefined || change === null || isNaN(change)) {
    return { value: "0.00%", color: "text-gray-400" };
  }
  const formatted = change.toFixed(2);
  if (change > 0) {
    return { value: `+${formatted}%`, color: "text-green-400" };
  } else if (change < 0) {
    return { value: `${formatted}%`, color: "text-red-400" };
  }
  return { value: `${formatted}%`, color: "text-gray-400" };
}

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatLargeNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) {
    return "$0.00";
  }
  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(2)}B`;
  } else if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  }
  return `$${num.toFixed(2)}`;
}

/**
 * Format USD price
 */
export function formatUsdPrice(price: string | number | undefined | null): string {
  if (price === undefined || price === null) {
    return "$0.00";
  }
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(numPrice)) {
    return "$0.00";
  }
  if (numPrice < 0.0001) {
    return `$${numPrice.toExponential(4)}`;
  } else if (numPrice < 1) {
    return `$${numPrice.toFixed(6)}`;
  } else if (numPrice < 1000) {
    return `$${numPrice.toFixed(4)}`;
  }
  return `$${numPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

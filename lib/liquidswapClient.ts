import { Aptos, AptosConfig, Network, type MoveStructId, type InputEntryFunctionData } from "@aptos-labs/ts-sdk";
import { NETWORK, APTOS_API_KEY } from "@/constants";

// LiquidSwap contract addresses - mainnet
const LIQUIDSWAP_MAINNET = {
  SCRIPTS_V2: "0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12",
  ROUTER_V05: "0x9dd974aea0f927ead664b9e1c295e4215bd441a9fb4e53e5ea0bf22f356c8a2b",
  CURVES: "0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12",
  CURVES_ALT: "0x163df34fccbf003ce219d3f1d9e70d140b60622cb9dd47599c25fb2f797ba6e",
} as const;

// LiquidSwap contract addresses - testnet (same addresses, but fewer pools)
const LIQUIDSWAP_TESTNET = {
  SCRIPTS_V2: "0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12",
  ROUTER_V05: "0x9dd974aea0f927ead664b9e1c295e4215bd441a9fb4e53e5ea0bf22f356c8a2b",
  CURVES: "0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12",
  CURVES_ALT: "0x163df34fccbf003ce219d3f1d9e70d140b60622cb9dd47599c25fb2f797ba6e",
} as const;

// Use appropriate contracts based on network
export const LIQUIDSWAP_CONTRACTS = NETWORK === "mainnet" ? LIQUIDSWAP_MAINNET : LIQUIDSWAP_TESTNET;

// Flag to indicate if LiquidSwap is available on current network
export const LIQUIDSWAP_AVAILABLE = NETWORK === "mainnet";

// Curve types
export const CURVE_TYPES = {
  UNCORRELATED: `${LIQUIDSWAP_CONTRACTS.CURVES}::curves::Uncorrelated`,
  STABLE: `${LIQUIDSWAP_CONTRACTS.CURVES}::curves::Stable`,
} as const;

// Map network to Aptos SDK network
const getAptosNetwork = (): Network => {
  switch (NETWORK) {
    case "mainnet":
      return Network.MAINNET;
    case "testnet":
    default:
      return Network.TESTNET;
  }
};

// Initialize Aptos client
const config = new AptosConfig({
  network: getAptosNetwork(),
  ...(APTOS_API_KEY && { clientConfig: { API_KEY: APTOS_API_KEY } }),
});

export const aptosClient = new Aptos(config);

// Common token addresses (same as Hyperion for compatibility)
export const COMMON_TOKENS = {
  APT: "0x1::aptos_coin::AptosCoin",
  USDC: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
  USDT: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT",
} as const;

// Fee configuration for LiquidSwap
export const LIQUIDSWAP_FEES = {
  UNCORRELATED: 0.003, // 0.3%
  STABLE: 0.001, // 0.1%
} as const;

// Types
export interface SwapEstimate {
  amountOut: bigint;
  priceImpact: number;
  route: string[];
  fee: bigint;
}

export interface PoolInfo {
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  curveType: "uncorrelated" | "stable";
  reserveA: bigint;
  reserveB: bigint;
}

export interface LiquidityInfo {
  lpTokenAmount: bigint;
  tokenAAmount: bigint;
  tokenBAmount: bigint;
}

/**
 * Build swap transaction payload for LiquidSwap
 */
export function buildSwapPayload(params: {
  tokenFrom: string;
  tokenTo: string;
  amountIn: number;
  minAmountOut: number;
  curveType?: "uncorrelated" | "stable";
}): InputEntryFunctionData {
  const curve = params.curveType === "stable" ? CURVE_TYPES.STABLE : CURVE_TYPES.UNCORRELATED;

  return {
    function: `${LIQUIDSWAP_CONTRACTS.SCRIPTS_V2}::scripts_v2::swap`,
    typeArguments: [params.tokenFrom, params.tokenTo, curve],
    functionArguments: [params.amountIn, params.minAmountOut],
  };
}

/**
 * Build create pool transaction payload for LiquidSwap
 */
export function buildCreatePoolPayload(params: {
  tokenA: string;
  tokenB: string;
  curveType?: "uncorrelated" | "stable";
}): InputEntryFunctionData {
  const curve = params.curveType === "stable" ? CURVE_TYPES.STABLE : CURVE_TYPES.UNCORRELATED;

  return {
    function: `${LIQUIDSWAP_CONTRACTS.SCRIPTS_V2}::scripts_v2::register_pool`,
    typeArguments: [params.tokenA, params.tokenB, curve],
    functionArguments: [],
  };
}

/**
 * Build add liquidity transaction payload for LiquidSwap
 */
export function buildAddLiquidityPayload(params: {
  tokenA: string;
  tokenB: string;
  amountA: number;
  amountB: number;
  minAmountA?: number;
  minAmountB?: number;
  curveType?: "uncorrelated" | "stable";
}): InputEntryFunctionData {
  const curve = params.curveType === "stable"
    ? `${LIQUIDSWAP_CONTRACTS.CURVES_ALT}::curves::Stable`
    : `${LIQUIDSWAP_CONTRACTS.CURVES_ALT}::curves::Uncorrelated`;

  return {
    function: `${LIQUIDSWAP_CONTRACTS.ROUTER_V05}::router::add_liquidity_v05`,
    typeArguments: [params.tokenA, params.tokenB, curve],
    functionArguments: [
      params.amountA,
      params.minAmountA ?? 0,
      params.amountB,
      params.minAmountB ?? 0,
    ],
  };
}

/**
 * Build remove liquidity transaction payload for LiquidSwap
 */
export function buildRemoveLiquidityPayload(params: {
  tokenA: string;
  tokenB: string;
  lpAmount: number;
  minAmountA?: number;
  minAmountB?: number;
  curveType?: "uncorrelated" | "stable";
}): InputEntryFunctionData {
  const curve = params.curveType === "stable"
    ? `${LIQUIDSWAP_CONTRACTS.CURVES_ALT}::curves::Stable`
    : `${LIQUIDSWAP_CONTRACTS.CURVES_ALT}::curves::Uncorrelated`;

  return {
    function: `${LIQUIDSWAP_CONTRACTS.ROUTER_V05}::router::remove_liquidity_v05`,
    typeArguments: [params.tokenA, params.tokenB, curve],
    functionArguments: [
      params.lpAmount,
      params.minAmountA ?? 0,
      params.minAmountB ?? 0,
    ],
  };
}

/**
 * Estimate swap output amount for LiquidSwap
 * Uses a simplified estimation since LiquidSwap doesn't have a public quote API
 * The actual swap will use minCoinOut = 0 (or slippage adjusted) like move-agent-kit
 */
export async function estimateSwapOutput(
  tokenIn: string,
  tokenOut: string,
  amountIn: number,
  curveType: "uncorrelated" | "stable" = "uncorrelated"
): Promise<SwapEstimate | null> {
  try {
    const curve = curveType === "stable" ? CURVE_TYPES.STABLE : CURVE_TYPES.UNCORRELATED;
    const fee = curveType === "stable" ? LIQUIDSWAP_FEES.STABLE : LIQUIDSWAP_FEES.UNCORRELATED;

    // Try to get reserves using view function
    let reserveIn: bigint | null = null;
    let reserveOut: bigint | null = null;

    // Try both token orderings
    for (const [tokenA, tokenB, isReverse] of [
      [tokenIn, tokenOut, false],
      [tokenOut, tokenIn, true],
    ] as const) {
      try {
        const result = await aptosClient.view({
          payload: {
            function: `${LIQUIDSWAP_CONTRACTS.SCRIPTS_V2}::liquidity_pool::get_reserves_size`,
            typeArguments: [tokenA, tokenB, curve],
            functionArguments: [],
          },
        });

        if (result && result.length >= 2) {
          const resA = BigInt(result[0] as string);
          const resB = BigInt(result[1] as string);
          if (resA > 0 && resB > 0) {
            reserveIn = isReverse ? resB : resA;
            reserveOut = isReverse ? resA : resB;
            break;
          }
        }
      } catch {
        // Try next ordering
      }
    }

    // If we got reserves, calculate output using AMM formula
    if (reserveIn && reserveOut && reserveIn > 0 && reserveOut > 0) {
      // AMM formula: Output = (amountIn * reserveOut * (1 - fee)) / (reserveIn + amountIn * (1 - fee))
      const amountInWithFee = BigInt(Math.floor(amountIn * (1 - fee)));
      const amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);

      const idealRate = Number(reserveOut) / Number(reserveIn);
      const actualRate = Number(amountOut) / amountIn;
      const priceImpact = Math.abs((idealRate - actualRate) / idealRate) * 100;

      return {
        amountOut,
        priceImpact,
        route: [tokenIn, tokenOut],
        fee: BigInt(Math.floor(amountIn * fee)),
      };
    }

    // Fallback: Return a simplified estimate assuming 1:1 rate minus fees
    // This allows the swap to proceed - actual rate determined on-chain
    const estimatedOutput = BigInt(Math.floor(amountIn * (1 - fee)));

    return {
      amountOut: estimatedOutput,
      priceImpact: 0,
      route: [tokenIn, tokenOut],
      fee: BigInt(Math.floor(amountIn * fee)),
    };
  } catch (error) {
    console.error("Failed to estimate swap:", error);
    // Even on error, return a basic estimate to allow the swap attempt
    const fee = curveType === "stable" ? LIQUIDSWAP_FEES.STABLE : LIQUIDSWAP_FEES.UNCORRELATED;
    return {
      amountOut: BigInt(Math.floor(amountIn * (1 - fee))),
      priceImpact: 0,
      route: [tokenIn, tokenOut],
      fee: BigInt(Math.floor(amountIn * fee)),
    };
  }
}

/**
 * Get pool information from LiquidSwap using view function
 */
export async function getPoolInfo(
  tokenA: string,
  tokenB: string,
  curveType: "uncorrelated" | "stable" = "uncorrelated"
): Promise<PoolInfo | null> {
  try {
    const curve = curveType === "stable" ? CURVE_TYPES.STABLE : CURVE_TYPES.UNCORRELATED;

    // Use the get_reserves_size view function to check if pool exists and get reserves
    try {
      const result = await aptosClient.view({
        payload: {
          function: `${LIQUIDSWAP_CONTRACTS.SCRIPTS_V2}::liquidity_pool::get_reserves_size`,
          typeArguments: [tokenA, tokenB, curve],
          functionArguments: [],
        },
      });

      if (result && result.length >= 2) {
        return {
          poolAddress: LIQUIDSWAP_CONTRACTS.SCRIPTS_V2,
          tokenA,
          tokenB,
          curveType,
          reserveA: BigInt(result[0] as string),
          reserveB: BigInt(result[1] as string),
        };
      }
    } catch {
      // View function failed, pool may not exist in this order
    }

    return null;
  } catch (error) {
    console.error("Failed to get pool info:", error);
    return null;
  }
}

/**
 * Check if a pool exists for the given token pair
 */
export async function poolExists(
  tokenA: string,
  tokenB: string,
  curveType: "uncorrelated" | "stable" = "uncorrelated"
): Promise<boolean> {
  const pool = await getPoolInfo(tokenA, tokenB, curveType);
  if (pool) return true;

  // Try reverse order
  const reversePool = await getPoolInfo(tokenB, tokenA, curveType);
  return reversePool !== null;
}

/**
 * Get LP token address for a pool
 */
export function getLPTokenAddress(
  tokenA: string,
  tokenB: string,
  curveType: "uncorrelated" | "stable" = "uncorrelated"
): string {
  const curve = curveType === "stable" ? CURVE_TYPES.STABLE : CURVE_TYPES.UNCORRELATED;
  return `${LIQUIDSWAP_CONTRACTS.SCRIPTS_V2}::liquidity_pool::LP<${tokenA}, ${tokenB}, ${curve}>`;
}

// Utility functions
export function formatSlippage(slippage: number): string {
  return `${(slippage * 100).toFixed(2)}%`;
}

export function formatPriceImpact(impact: number): string {
  const formatted = impact.toFixed(2);
  if (impact > 5) return `${formatted}% (High)`;
  if (impact > 1) return `${formatted}% (Medium)`;
  return `${formatted}%`;
}

/**
 * Calculate minimum output amount with slippage
 */
export function calculateMinOutput(amount: bigint, slippagePercent: number): number {
  const slippageMultiplier = 1 - (slippagePercent / 100);
  return Math.floor(Number(amount) * slippageMultiplier);
}

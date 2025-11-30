/**
 * DEX Abstraction Layer
 * Provides a unified interface for swapping between Hyperion and LiquidSwap DEXes
 */

import type { InputEntryFunctionData } from "@aptos-labs/ts-sdk";
import * as hyperion from "./hyperionClient";
import * as liquidswap from "./liquidswapClient";

// DEX Provider Types
export type DexProvider = "hyperion" | "liquidswap";

export const DEX_PROVIDERS: Record<DexProvider, { name: string; description: string; icon: string }> = {
  hyperion: {
    name: "Hyperion",
    description: "Concentrated liquidity DEX with advanced routing",
    icon: "/image/hyperion.png",
  },
  liquidswap: {
    name: "LiquidSwap",
    description: "Classic AMM with stable and uncorrelated pools",
    icon: "/image/liquidswap.png",
  },
};

// Common tokens (shared between both DEXes)
export const COMMON_TOKENS = hyperion.COMMON_TOKENS;

// Unified types
export interface SwapEstimate {
  amountOut: bigint;
  priceImpact: number;
  route: string[];
  fee: bigint;
  provider: DexProvider;
}

export interface SwapParams {
  tokenFrom: string;
  tokenTo: string;
  amountIn: number;
  slippage: number;
  recipient: string;
  provider: DexProvider;
  // LiquidSwap-specific
  curveType?: "uncorrelated" | "stable";
}

export interface PoolInfo {
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  liquidity: bigint;
  provider: DexProvider;
}

/**
 * Estimate swap output from the specified DEX provider
 */
export async function estimateSwapOutput(
  tokenIn: string,
  tokenOut: string,
  amountIn: number,
  provider: DexProvider,
  curveType?: "uncorrelated" | "stable"
): Promise<SwapEstimate | null> {
  try {
    if (provider === "hyperion") {
      const estimate = await hyperion.estimateSwapOutput(tokenIn, tokenOut, amountIn);
      if (!estimate) {
        // Hyperion estimation failed, return null to trigger error message
        return null;
      }

      return {
        amountOut: estimate.amountOut,
        priceImpact: estimate.priceImpact,
        route: estimate.route,
        fee: estimate.fee,
        provider: "hyperion",
      };
    } else {
      // LiquidSwap - always returns an estimate (may be simplified)
      const estimate = await liquidswap.estimateSwapOutput(tokenIn, tokenOut, amountIn, curveType);
      if (!estimate) return null;

      return {
        amountOut: estimate.amountOut,
        priceImpact: estimate.priceImpact,
        route: estimate.route,
        fee: estimate.fee,
        provider: "liquidswap",
      };
    }
  } catch (error) {
    console.error(`Failed to estimate swap on ${provider}:`, error);
    return null;
  }
}

/**
 * Get the best swap estimate across all providers
 */
export async function getBestSwapEstimate(
  tokenIn: string,
  tokenOut: string,
  amountIn: number
): Promise<SwapEstimate | null> {
  const providers: DexProvider[] = ["hyperion", "liquidswap"];
  const estimates: (SwapEstimate | null)[] = await Promise.all(
    providers.map((provider) => estimateSwapOutput(tokenIn, tokenOut, amountIn, provider))
  );

  // Filter out null estimates and find the best one (highest output)
  const validEstimates = estimates.filter((e): e is SwapEstimate => e !== null);

  if (validEstimates.length === 0) return null;

  return validEstimates.reduce((best, current) =>
    current.amountOut > best.amountOut ? current : best
  );
}

/**
 * Build swap transaction payload for the specified provider
 */
export async function buildSwapPayload(params: SwapParams): Promise<InputEntryFunctionData> {
  if (params.provider === "hyperion") {
    // First get the route estimate
    const estimate = await hyperion.estimateSwapOutput(
      params.tokenFrom,
      params.tokenTo,
      params.amountIn
    );

    if (!estimate) {
      throw new Error("No liquidity route found on Hyperion");
    }

    const outputAmount = Number(estimate.amountOut);
    const minOutput = Math.floor(outputAmount * (1 - params.slippage / 100));

    const payload = await hyperion.buildSwapPayload({
      currencyA: params.tokenFrom,
      currencyB: params.tokenTo,
      currencyAAmount: params.amountIn,
      currencyBAmount: minOutput,
      slippage: params.slippage / 100,
      poolRoute: estimate.route,
      recipient: params.recipient,
    });

    return payload as InputEntryFunctionData;
  } else {
    // LiquidSwap
    const estimate = await liquidswap.estimateSwapOutput(
      params.tokenFrom,
      params.tokenTo,
      params.amountIn,
      params.curveType
    );

    const minOutput = estimate
      ? liquidswap.calculateMinOutput(estimate.amountOut, params.slippage)
      : 0;

    return liquidswap.buildSwapPayload({
      tokenFrom: params.tokenFrom,
      tokenTo: params.tokenTo,
      amountIn: params.amountIn,
      minAmountOut: minOutput,
      curveType: params.curveType,
    });
  }
}

/**
 * Build create pool transaction payload
 */
export function buildCreatePoolPayload(params: {
  tokenA: string;
  tokenB: string;
  provider: DexProvider;
  // Hyperion-specific
  feeTierIndex?: number;
  currentPriceTick?: number;
  tickLower?: number;
  tickUpper?: number;
  currencyAAmount?: number;
  currencyBAmount?: number;
  slippage?: number;
  // LiquidSwap-specific
  curveType?: "uncorrelated" | "stable";
}): InputEntryFunctionData | Promise<InputEntryFunctionData> {
  if (params.provider === "hyperion") {
    return hyperion.buildCreatePoolPayload({
      currencyA: params.tokenA,
      currencyB: params.tokenB,
      currencyAAmount: params.currencyAAmount || 0,
      currencyBAmount: params.currencyBAmount || 0,
      feeTierIndex: params.feeTierIndex || 2,
      currentPriceTick: params.currentPriceTick || 0,
      tickLower: params.tickLower || -887220,
      tickUpper: params.tickUpper || 887220,
      slippage: params.slippage || 0.5,
    }) as Promise<InputEntryFunctionData>;
  } else {
    return liquidswap.buildCreatePoolPayload({
      tokenA: params.tokenA,
      tokenB: params.tokenB,
      curveType: params.curveType,
    });
  }
}

/**
 * Build add liquidity transaction payload
 */
export function buildAddLiquidityPayload(params: {
  tokenA: string;
  tokenB: string;
  amountA: number;
  amountB: number;
  provider: DexProvider;
  slippage?: number;
  // Hyperion-specific
  positionId?: string;
  feeTierIndex?: number;
  // LiquidSwap-specific
  curveType?: "uncorrelated" | "stable";
}): InputEntryFunctionData | Promise<InputEntryFunctionData> {
  if (params.provider === "hyperion") {
    return hyperion.buildAddLiquidityPayload({
      positionId: params.positionId || "",
      currencyA: params.tokenA,
      currencyB: params.tokenB,
      currencyAAmount: params.amountA,
      currencyBAmount: params.amountB,
      feeTierIndex: params.feeTierIndex || 2,
      slippage: params.slippage || 0.5,
    }) as Promise<InputEntryFunctionData>;
  } else {
    const minA = Math.floor(params.amountA * (1 - (params.slippage || 0.5) / 100));
    const minB = Math.floor(params.amountB * (1 - (params.slippage || 0.5) / 100));

    return liquidswap.buildAddLiquidityPayload({
      tokenA: params.tokenA,
      tokenB: params.tokenB,
      amountA: params.amountA,
      amountB: params.amountB,
      minAmountA: minA,
      minAmountB: minB,
      curveType: params.curveType,
    });
  }
}

/**
 * Build remove liquidity transaction payload
 */
export function buildRemoveLiquidityPayload(params: {
  tokenA: string;
  tokenB: string;
  provider: DexProvider;
  slippage?: number;
  recipient: string;
  // Hyperion-specific
  positionId?: string;
  currencyAAmount?: number;
  currencyBAmount?: number;
  deltaLiquidity?: bigint;
  // LiquidSwap-specific
  lpAmount?: number;
  curveType?: "uncorrelated" | "stable";
}): InputEntryFunctionData | Promise<InputEntryFunctionData> {
  if (params.provider === "hyperion") {
    return hyperion.buildRemoveLiquidityPayload({
      positionId: params.positionId || "",
      currencyA: params.tokenA,
      currencyB: params.tokenB,
      currencyAAmount: params.currencyAAmount || 0,
      currencyBAmount: params.currencyBAmount || 0,
      deltaLiquidity: params.deltaLiquidity || BigInt(0),
      slippage: params.slippage || 0.5,
      recipient: params.recipient,
    }) as Promise<InputEntryFunctionData>;
  } else {
    const minA = params.currencyAAmount
      ? Math.floor(params.currencyAAmount * (1 - (params.slippage || 0.5) / 100))
      : 0;
    const minB = params.currencyBAmount
      ? Math.floor(params.currencyBAmount * (1 - (params.slippage || 0.5) / 100))
      : 0;

    return liquidswap.buildRemoveLiquidityPayload({
      tokenA: params.tokenA,
      tokenB: params.tokenB,
      lpAmount: params.lpAmount || 0,
      minAmountA: minA,
      minAmountB: minB,
      curveType: params.curveType,
    });
  }
}

// Re-export useful utilities
export { formatSlippage, formatPriceImpact } from "./hyperionClient";
export { FEE_TIERS } from "./hyperionClient";
export { LIQUIDSWAP_FEES, CURVE_TYPES } from "./liquidswapClient";

import { Network } from "@aptos-labs/ts-sdk";
import { initHyperionSDK } from "@hyperionxyz/sdk";
import { NETWORK, APTOS_API_KEY } from "@/constants";

// Map wallet adapter network to Aptos SDK network
const getAptosNetwork = (): Network.MAINNET | Network.TESTNET => {
  switch (NETWORK) {
    case "mainnet":
      return Network.MAINNET;
    case "testnet":
    default:
      return Network.TESTNET;
  }
};

// Initialize Hyperion SDK
export const hyperion = initHyperionSDK({
  network: getAptosNetwork(),
  APTOS_API_KEY: APTOS_API_KEY || "",
});

// Fee tier configuration
export const FEE_TIERS = [
  { index: 0, tickSpacing: 1, feeRate: "0.01%", label: "Best for stable pairs" },
  { index: 1, tickSpacing: 10, feeRate: "0.05%", label: "Best for stable pairs" },
  { index: 2, tickSpacing: 60, feeRate: "0.3%", label: "Best for most pairs" },
  { index: 3, tickSpacing: 200, feeRate: "1%", label: "Best for exotic pairs" },
  { index: 4, tickSpacing: 20, feeRate: "0.1%", label: "For medium volatility" },
  { index: 5, tickSpacing: 50, feeRate: "0.25%", label: "For medium volatility" },
] as const;

// Common token addresses
export const COMMON_TOKENS = {
  APT: "0x1::aptos_coin::AptosCoin",
  USDC: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
  USDT: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT",
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
  feeTier: number;
  liquidity: bigint;
  sqrtPrice: bigint;
  tick: number;
}

// Swap functions
export async function estimateSwapOutput(
  tokenIn: string,
  tokenOut: string,
  amountIn: number
): Promise<SwapEstimate | null> {
  try {
    const result = await hyperion.Swap.estToAmount({
      from: tokenIn,
      to: tokenOut,
      amount: amountIn,
    });

    return {
      amountOut: BigInt(Math.floor(result.amount || 0)),
      priceImpact: result.priceImpact || 0,
      route: result.poolRoute || [],
      fee: BigInt(0),
    };
  } catch (error) {
    console.error("Failed to estimate swap:", error);
    return null;
  }
}

export async function estimateSwapInput(
  tokenIn: string,
  tokenOut: string,
  amountOut: number
): Promise<{ amountIn: bigint; route: string[] } | null> {
  try {
    const result = await hyperion.Swap.estFromAmount({
      from: tokenIn,
      to: tokenOut,
      amount: amountOut,
    });

    return {
      amountIn: BigInt(Math.floor(result.amount || 0)),
      route: result.poolRoute || [],
    };
  } catch (error) {
    console.error("Failed to estimate swap input:", error);
    return null;
  }
}

export async function buildSwapPayload(params: {
  currencyA: string;
  currencyB: string;
  currencyAAmount: number;
  currencyBAmount: number;
  slippage: number;
  poolRoute: string[];
  recipient: string;
}) {
  try {
    const payload = await hyperion.Swap.swapTransactionPayload({
      currencyA: params.currencyA,
      currencyB: params.currencyB,
      currencyAAmount: params.currencyAAmount,
      currencyBAmount: params.currencyBAmount,
      slippage: params.slippage,
      poolRoute: params.poolRoute,
      recipient: params.recipient,
    });
    return payload;
  } catch (error) {
    console.error("Failed to build swap payload:", error);
    throw error;
  }
}

// Pool functions
export async function getPoolsForPair(
  tokenA: string,
  tokenB: string,
  feeTier: number = 2
): Promise<PoolInfo[]> {
  try {
    const pool = await hyperion.Pool.getPoolByTokenPairAndFeeTier({
      token1: tokenA,
      token2: tokenB,
      feeTier: feeTier as any,
    });
    if (!pool) return [];
    return [{
      poolAddress: pool.poolAddress || pool.id,
      tokenA: pool.currencyA || tokenA,
      tokenB: pool.currencyB || tokenB,
      feeTier: pool.feeTierIndex || feeTier,
      liquidity: BigInt(pool.liquidity || 0),
      sqrtPrice: BigInt(pool.sqrtPrice || 0),
      tick: pool.currentTick || 0,
    }];
  } catch (error) {
    console.error("Failed to get pools:", error);
    return [];
  }
}

export async function fetchAllPools(): Promise<any[]> {
  try {
    const pools = await hyperion.Pool.fetchAllPools();
    return pools || [];
  } catch (error) {
    console.error("Failed to fetch all pools:", error);
    return [];
  }
}

export async function buildCreatePoolPayload(params: {
  currencyA: string;
  currencyB: string;
  currencyAAmount: number;
  currencyBAmount: number;
  feeTierIndex: number;
  currentPriceTick: number;
  tickLower: number;
  tickUpper: number;
  slippage: number;
}) {
  try {
    const payload = await hyperion.Pool.createPoolTransactionPayload({
      currencyA: params.currencyA,
      currencyB: params.currencyB,
      currencyAAmount: params.currencyAAmount,
      currencyBAmount: params.currencyBAmount,
      feeTierIndex: params.feeTierIndex,
      currentPriceTick: params.currentPriceTick,
      tickLower: params.tickLower,
      tickUpper: params.tickUpper,
      slippage: params.slippage,
    });
    return payload;
  } catch (error) {
    console.error("Failed to build create pool payload:", error);
    throw error;
  }
}

// Position functions
export async function getUserPositions(walletAddress: string) {
  try {
    const positions = await hyperion.Position.fetchAllPositionsByAddress({ address: walletAddress });
    return positions || [];
  } catch (error) {
    console.error("Failed to get positions:", error);
    return [];
  }
}

export async function buildAddLiquidityPayload(params: {
  positionId: string;
  currencyA: string;
  currencyB: string;
  currencyAAmount: number;
  currencyBAmount: number;
  feeTierIndex: number;
  slippage: number;
}) {
  try {
    const payload = await hyperion.Position.addLiquidityTransactionPayload({
      positionId: params.positionId,
      currencyA: params.currencyA,
      currencyB: params.currencyB,
      currencyAAmount: params.currencyAAmount,
      currencyBAmount: params.currencyBAmount,
      feeTierIndex: params.feeTierIndex,
      slippage: params.slippage,
    });
    return payload;
  } catch (error) {
    console.error("Failed to build add liquidity payload:", error);
    throw error;
  }
}

export async function buildRemoveLiquidityPayload(params: {
  positionId: string;
  currencyA: string;
  currencyB: string;
  currencyAAmount: number;
  currencyBAmount: number;
  deltaLiquidity: bigint;
  slippage: number;
  recipient: string;
}) {
  try {
    const payload = hyperion.Position.removeLiquidityTransactionPayload({
      positionId: params.positionId,
      currencyA: params.currencyA,
      currencyB: params.currencyB,
      currencyAAmount: params.currencyAAmount,
      currencyBAmount: params.currencyBAmount,
      deltaLiquidity: params.deltaLiquidity.toString(),
      slippage: params.slippage,
      recipient: params.recipient,
    });
    return payload;
  } catch (error) {
    console.error("Failed to build remove liquidity payload:", error);
    throw error;
  }
}

export async function buildCollectFeePayload(positionId: string, recipient: string) {
  try {
    const payload = hyperion.Position.claimFeeTransactionPayload({
      positionId,
      recipient,
    });
    return payload;
  } catch (error) {
    console.error("Failed to build collect fee payload:", error);
    throw error;
  }
}

// Utility functions
export function priceToTick(price: number, tickSpacing: number): number {
  // Convert price to tick using the formula: tick = log(price) / log(1.0001)
  const tick = Math.floor(Math.log(price) / Math.log(1.0001));
  // Round to nearest valid tick based on spacing
  return Math.round(tick / tickSpacing) * tickSpacing;
}

export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

// Format helpers
export function formatSlippage(slippage: number): string {
  return `${(slippage * 100).toFixed(2)}%`;
}

export function formatPriceImpact(impact: number): string {
  const formatted = (impact * 100).toFixed(2);
  if (impact > 0.05) return `${formatted}% (High)`;
  if (impact > 0.01) return `${formatted}% (Medium)`;
  return `${formatted}%`;
}

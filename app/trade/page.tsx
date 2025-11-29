"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";
import { MagicCard } from "@/components/ui/magic-card";
import {
  ArrowDownUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  ExternalLink,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  BarChart3,
  Flame,
  Zap,
  Shield,
  Info,
} from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  estimateSwapOutput,
  buildSwapPayload,
  COMMON_TOKENS,
  formatPriceImpact,
} from "@/lib/hyperionClient";
import {
  getWalletFungibleAssets,
  formatTokenBalance,
} from "@/lib/lilipadClient";
import {
  getTokenPairs,
  getChartEmbedUrl,
  getPairUrl,
  formatPriceChange,
  formatLargeNumber,
  formatUsdPrice,
  type PairData,
} from "@/lib/dexscreenerClient";
import { NETWORK } from "@/constants";

const poppins = Poppins({ weight: ["200", "300", "400", "700"], subsets: ["latin"] });

interface TokenOption {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance?: bigint;
  iconUri?: string;
}

const DEFAULT_TOKENS: TokenOption[] = [
  {
    address: COMMON_TOKENS.APT,
    symbol: "APT",
    name: "Aptos Coin",
    decimals: 8,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/APT.webp",
  },
  {
    address: COMMON_TOKENS.USDC,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/USDC.svg",
  },
  {
    address: COMMON_TOKENS.USDT,
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    iconUri: "https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/USDT.svg",
  },
];

export default function Trade() {
  const { account, signAndSubmitTransaction, connected } = useWallet();

  // Token selection state
  const [tokenFrom, setTokenFrom] = useState<TokenOption>(DEFAULT_TOKENS[0]);
  const [tokenTo, setTokenTo] = useState<TokenOption>(DEFAULT_TOKENS[1]);
  const [availableTokens, setAvailableTokens] = useState<TokenOption[]>(DEFAULT_TOKENS);

  // Input state
  const [amountFrom, setAmountFrom] = useState("");
  const [amountTo, setAmountTo] = useState("");

  // Swap state
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapRoute, setSwapRoute] = useState<string[]>([]);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<{ success: boolean; hash?: string; message: string } | null>(null);

  // Settings
  const [slippage, setSlippage] = useState(0.5);
  const [showTokenSelector, setShowTokenSelector] = useState<"from" | "to" | null>(null);

  // Loading
  const [loadingBalances, setLoadingBalances] = useState(false);

  // DexScreener data
  const [pairData, setPairData] = useState<PairData | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [showChart, setShowChart] = useState(true);

  // Load wallet tokens
  useEffect(() => {
    async function loadTokens() {
      if (!account?.address) {
        setAvailableTokens(DEFAULT_TOKENS);
        return;
      }

      setLoadingBalances(true);
      try {
        const walletTokens = await getWalletFungibleAssets(account.address.toString());

        // Merge with default tokens
        const tokenMap = new Map<string, TokenOption>();

        // Add default tokens first
        DEFAULT_TOKENS.forEach(t => tokenMap.set(t.address, t));

        // Add wallet tokens with balances
        walletTokens.forEach(t => {
          const existing = tokenMap.get(t.metadata);
          if (existing) {
            tokenMap.set(t.metadata, { ...existing, balance: t.balance });
          } else {
            tokenMap.set(t.metadata, {
              address: t.metadata,
              symbol: t.symbol,
              name: t.name,
              decimals: t.decimals,
              balance: t.balance,
              iconUri: t.iconUri,
            });
          }
        });

        setAvailableTokens(Array.from(tokenMap.values()));

        // Update selected tokens with balances
        const updatedFrom = tokenMap.get(tokenFrom.address);
        const updatedTo = tokenMap.get(tokenTo.address);
        if (updatedFrom) setTokenFrom(updatedFrom);
        if (updatedTo) setTokenTo(updatedTo);
      } catch (err) {
        console.error("Failed to load tokens:", err);
      } finally {
        setLoadingBalances(false);
      }
    }

    loadTokens();
  }, [account?.address]);

  // Load DexScreener data for the selected token pair
  useEffect(() => {
    async function loadPairData() {
      // Try to find pair data for the "from" token (usually the one being traded)
      const tokenToCheck = tokenFrom.address !== COMMON_TOKENS.APT ? tokenFrom.address : tokenTo.address;

      if (!tokenToCheck || tokenToCheck === COMMON_TOKENS.APT) {
        // If both are common tokens, try USDC
        if (tokenTo.address === COMMON_TOKENS.USDC || tokenFrom.address === COMMON_TOKENS.USDC) {
          setPairData(null);
          return;
        }
      }

      setLoadingChart(true);
      try {
        const pairs = await getTokenPairs(tokenToCheck);
        if (pairs.length > 0) {
          // Get the pair with highest liquidity
          const bestPair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
          setPairData(bestPair);
        } else {
          setPairData(null);
        }
      } catch (err) {
        console.error("Failed to load pair data:", err);
        setPairData(null);
      } finally {
        setLoadingChart(false);
      }
    }

    loadPairData();
  }, [tokenFrom.address, tokenTo.address]);

  // Estimate swap output
  const estimateOutput = useCallback(async () => {
    if (!amountFrom || parseFloat(amountFrom) <= 0) {
      setAmountTo("");
      setSwapRoute([]);
      setPriceImpact(0);
      return;
    }

    setIsEstimating(true);
    setError(null);

    try {
      const inputAmount = parseFloat(amountFrom) * Math.pow(10, tokenFrom.decimals);

      const estimate = await estimateSwapOutput(
        tokenFrom.address,
        tokenTo.address,
        inputAmount
      );

      if (estimate) {
        const outputAmount = Number(estimate.amountOut) / Math.pow(10, tokenTo.decimals);
        setAmountTo(outputAmount.toFixed(6));
        setSwapRoute(estimate.route);
        setPriceImpact(estimate.priceImpact);
      } else {
        setError("No liquidity pool found for this pair");
        setAmountTo("");
      }
    } catch (err) {
      console.error("Estimation error:", err);
      setError("Failed to estimate swap. Pool may not exist.");
      setAmountTo("");
    } finally {
      setIsEstimating(false);
    }
  }, [amountFrom, tokenFrom, tokenTo]);

  // Debounced estimation
  useEffect(() => {
    const timer = setTimeout(() => {
      estimateOutput();
    }, 500);

    return () => clearTimeout(timer);
  }, [estimateOutput]);

  // Swap tokens position
  const handleSwapTokens = () => {
    const tempToken = tokenFrom;
    const tempAmount = amountFrom;

    setTokenFrom(tokenTo);
    setTokenTo(tempToken);
    setAmountFrom(amountTo);
    setAmountTo(tempAmount);
  };

  // Execute swap
  const handleSwap = async () => {
    if (!connected || !account?.address) {
      setError("Please connect your wallet");
      return;
    }

    if (!amountFrom || !amountTo || swapRoute.length === 0) {
      setError("Invalid swap parameters");
      return;
    }

    setIsSwapping(true);
    setError(null);
    setTxResult(null);

    try {
      const inputAmount = parseFloat(amountFrom) * Math.pow(10, tokenFrom.decimals);
      const outputAmount = parseFloat(amountTo) * Math.pow(10, tokenTo.decimals);

      const payload = await buildSwapPayload({
        currencyA: tokenFrom.address,
        currencyB: tokenTo.address,
        currencyAAmount: inputAmount,
        currencyBAmount: outputAmount,
        slippage: slippage / 100,
        poolRoute: swapRoute,
        recipient: account.address.toString(),
      });

      const response = await signAndSubmitTransaction({
        data: payload,
      });

      setTxResult({
        success: true,
        hash: response.hash,
        message: `Successfully swapped ${amountFrom} ${tokenFrom.symbol} for ${amountTo} ${tokenTo.symbol}`,
      });

      // Reset form
      setAmountFrom("");
      setAmountTo("");
      setSwapRoute([]);
    } catch (err: any) {
      console.error("Swap failed:", err);
      setTxResult({
        success: false,
        message: err.message || "Swap transaction failed",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  // Token selector
  const selectToken = (token: TokenOption, type: "from" | "to") => {
    if (type === "from") {
      if (token.address === tokenTo.address) {
        setTokenTo(tokenFrom);
      }
      setTokenFrom(token);
    } else {
      if (token.address === tokenFrom.address) {
        setTokenFrom(tokenTo);
      }
      setTokenTo(token);
    }
    setShowTokenSelector(null);
    setAmountTo("");
  };

  // Calculate rate
  const rate = amountFrom && amountTo && parseFloat(amountFrom) > 0
    ? (parseFloat(amountTo) / parseFloat(amountFrom)).toFixed(6)
    : null;

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden bg-[url('/image/bg.png')] bg-cover ${poppins.className}`}>
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar>
          <main className="flex-1 flex flex-col p-4 overflow-auto">
            <div className="flex items-center gap-4 mb-4">
              <SidebarTrigger />
              <h1 className="text-2xl font-light text-white">Trade</h1>
              <div className="flex-1" />
              <button
                onClick={() => setShowChart(!showChart)}
                className={`p-2 rounded-lg transition-colors ${showChart ? "bg-[#D4F6D3] text-[#0B1418]" : "bg-white/5 hover:bg-white/10 text-gray-400"}`}
              >
                <BarChart3 className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 max-w-[1800px] mx-auto w-full flex flex-col gap-4">
              {/* Market Data Feed - TOP */}
              {showChart && pairData && (
                <div className="py-6 px-8 rounded-xl w-full bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between">
                    {/* Left: Token pair info */}
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-4">
                        {/* Overlapping coin icons */}
                        <div className="flex items-center">
                          <div className="w-14 h-14 rounded-full bg-[#0B1418] border-2 border-white/20 flex items-center justify-center overflow-hidden z-10">
                            {pairData.info?.imageUrl ? (
                              <img src={pairData.info.imageUrl} alt={pairData.baseToken.symbol} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white font-medium text-lg">{pairData.baseToken.symbol.charAt(0)}</span>
                            )}
                          </div>
                          <div className="w-14 h-14 rounded-full bg-[#0B1418] border-2 border-white/20 flex items-center justify-center overflow-hidden -ml-4">
                            {pairData.quoteToken.symbol === "APT" ? (
                              <img src="https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/APT.webp" alt="APT" className="w-full h-full object-cover" />
                            ) : pairData.quoteToken.symbol === "USDC" ? (
                              <img src="https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/USDC.svg" alt="USDC" className="w-full h-full object-cover" />
                            ) : pairData.quoteToken.symbol === "USDT" ? (
                              <img src="https://raw.githubusercontent.com/hippospace/aptos-coin-list/main/icons/USDT.svg" alt="USDT" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white font-medium text-lg">{pairData.quoteToken.symbol.charAt(0)}</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-white font-semimedium text-2xl">{pairData.baseToken.symbol}/{pairData.quoteToken.symbol}</span>
                          <p className="text-gray-400 text-sm">Aptos Network</p>
                        </div>
                      </div>
                      <div className="h-14 w-px bg-white/10" />
                      <div>
                        <span className="text-4xl font-medium text-white">{formatUsdPrice(pairData.priceUsd)}</span>
                        {(() => {
                          const changeValue = pairData.priceChange?.h24;
                          const change = formatPriceChange(changeValue);
                          return (
                            <div className={`flex items-center gap-1 mt-1 ${change.color}`}>
                              {(changeValue ?? 0) >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                              <span className="font-semimedium text-lg">{change.value}</span>
                              <span className="text-gray-400 text-sm">(24h)</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Right: Market stats */}
                    <div className="flex items-center gap-6">
                      <div className="flex gap-10">
                        <div>
                          <div className="text-gray-400 text-sm mb-1">24h Volume</div>
                          <div className="text-white font-semimedium text-xl">{formatLargeNumber(pairData.volume?.h24)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-sm mb-1">Liquidity</div>
                          <div className="text-white font-semimedium text-xl">{formatLargeNumber(pairData.liquidity?.usd)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-sm mb-1">24h Transactions</div>
                          <div className="text-white font-semimedium text-xl">
                            <span className="text-green-400">{pairData.txns?.h24?.buys ?? 0}</span>
                            <span className="text-gray-500 mx-1">/</span>
                            <span className="text-red-400">{pairData.txns?.h24?.sells ?? 0}</span>
                          </div>
                        </div>
                      </div>
                      <a href={getPairUrl(pairData.pairAddress)} target="_blank" rel="noopener noreferrer" className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-[#D4F6D3]">
                        <ExternalLink className="h-5 w-5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart (left) + Swap (right) - BOTTOM */}
              <div className={`flex-1 flex gap-4 ${showChart ? "flex-row items-stretch" : "justify-center items-start"}`}>

                {/* Chart Section - LEFT */}
                {showChart && (
                  <div className="flex-1 min-w-0 h-[600px] rounded-xl overflow-hidden">
                    {loadingChart ? (
                      <div className="w-full h-full flex items-center justify-center bg-white/5 border border-white/10 rounded-xl">
                        <Loader2 className="h-8 w-8 text-[#D4F6D3] animate-spin" />
                      </div>
                    ) : pairData ? (
                      <iframe
                        src={getChartEmbedUrl(pairData.pairAddress)}
                        className="w-full h-full border-0 rounded-xl"
                        title="DexScreener Chart"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-white/5 border border-white/10 rounded-xl">
                        <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                        <p>No chart data available for this pair</p>
                        <p className="text-sm mt-2">Select a token with trading history</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Swap Card - RIGHT */}
                <div className={`flex flex-col gap-4 ${showChart ? "w-[600px] flex-shrink-0" : "w-full max-w-md"}`}>
                  {/* Swap Card */}
                  <MagicCard className="p-4 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                    {/* Header with Slippage */}
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg font-medium text-white">Swap</h2>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 text-xs">Slippage:</span>
                        {[0.5, 1.0].map((value) => (
                          <button
                            key={value}
                            onClick={() => setSlippage(value)}
                            className={`px-2 py-1 rounded text-xs transition-colors ${
                              slippage === value
                                ? "bg-[#D4F6D3] text-[#0B1418]"
                                : "bg-white/10 text-white hover:bg-white/20"
                            }`}
                          >
                            {value}%
                          </button>
                        ))}
                        <input
                          type="number"
                          value={slippage}
                          onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
                          className="w-12 px-2 py-1 bg-white/10 rounded text-white text-xs outline-none text-center"
                          step="0.1"
                          min="0.01"
                          max="50"
                        />
                      </div>
                    </div>

                    {/* From Token */}
                    <div className="bg-white/5 rounded-xl p-3 mb-2">
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-400 text-xs">From</span>
                        {tokenFrom.balance !== undefined && (
                          <button
                            onClick={() => setAmountFrom(formatTokenBalance(tokenFrom.balance!, tokenFrom.decimals))}
                            className="text-gray-400 text-xs hover:text-[#D4F6D3] transition-colors"
                          >
                            Balance: {formatTokenBalance(tokenFrom.balance, tokenFrom.decimals)}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={amountFrom}
                          onChange={(e) => setAmountFrom(e.target.value)}
                          placeholder="0.0"
                          className="flex-1 min-w-0 bg-transparent text-white text-xl outline-none"
                        />
                        <button
                          onClick={() => setShowTokenSelector("from")}
                          className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                        >
                          <div className="w-6 h-6 flex-shrink-0">
                            {tokenFrom.iconUri ? (
                              <img src={tokenFrom.iconUri} alt={tokenFrom.symbol} className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                <span className="text-white text-xs font-medium">{tokenFrom.symbol.charAt(0)}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-white font-medium text-sm">{tokenFrom.symbol}</span>
                          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        </button>
                      </div>
                    </div>

                    {/* Swap Button */}
                    <div className="flex justify-center -my-1 relative z-10">
                      <button
                        onClick={handleSwapTokens}
                        className="p-2 bg-[#0B1418] border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                      >
                        <ArrowDownUp className="h-4 w-4 text-[#D4F6D3]" />
                      </button>
                    </div>

                    {/* To Token */}
                    <div className="bg-white/5 rounded-xl p-3 mt-2">
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-400 text-xs">To</span>
                        {tokenTo.balance !== undefined && (
                          <span className="text-gray-400 text-xs">
                            Balance: {formatTokenBalance(tokenTo.balance, tokenTo.decimals)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 flex items-center">
                          {isEstimating ? (
                            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                          ) : (
                            <span className="text-white text-xl truncate">
                              {amountTo || "0.0"}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setShowTokenSelector("to")}
                          className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                        >
                          <div className="w-6 h-6 flex-shrink-0">
                            {tokenTo.iconUri ? (
                              <img src={tokenTo.iconUri} alt={tokenTo.symbol} className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                <span className="text-white text-xs font-medium">{tokenTo.symbol.charAt(0)}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-white font-medium text-sm">{tokenTo.symbol}</span>
                          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        </button>
                      </div>
                    </div>

                    {/* Swap Info */}
                    {rate && (
                      <div className="mt-3 p-2 bg-white/5 rounded-xl space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Rate</span>
                          <span className="text-white">1 {tokenFrom.symbol} = {rate} {tokenTo.symbol}</span>
                        </div>
                        {priceImpact > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Price Impact</span>
                            <span className={priceImpact > 5 ? "text-red-400" : priceImpact > 1 ? "text-yellow-400" : "text-green-400"}>
                              {formatPriceImpact(priceImpact / 100)}
                            </span>
                          </div>
                        )}
                        {swapRoute.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Route</span>
                            <span className="text-white">{swapRoute.length} hop{swapRoute.length > 1 ? "s" : ""}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error */}
                    {error && (
                      <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                        <span className="text-red-400 text-xs">{error}</span>
                      </div>
                    )}

                    {/* Transaction Result */}
                    {txResult && (
                      <div className={`mt-2 p-2 rounded-xl flex items-start gap-2 ${
                        txResult.success ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"
                      }`}>
                        {txResult.success ? (
                          <div className="flex-1">
                            <p className="text-green-400 text-xs">{txResult.message}</p>
                            {txResult.hash && (
                              <a
                                href={`https://explorer.aptoslabs.com/txn/${txResult.hash}?network=${NETWORK}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-400/70 text-xs flex items-center gap-1 mt-1 hover:text-green-400"
                              >
                                View on Explorer <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-red-400 text-xs">{txResult.message}</p>
                        )}
                      </div>
                    )}

                    {/* Swap Button */}
                    <button
                      onClick={handleSwap}
                      disabled={!connected || isSwapping || isEstimating || !amountFrom || !amountTo || !!error}
                      className={`w-full mt-3 py-3 rounded-xl font-medium transition-all ${
                        !connected
                          ? "bg-white/10 text-gray-400 cursor-not-allowed"
                          : isSwapping || isEstimating || !amountFrom || !amountTo || error
                          ? "bg-white/10 text-gray-400 cursor-not-allowed"
                          : "bg-[#D4F6D3] text-[#0B1418] hover:bg-[#c2e8c1]"
                      }`}
                    >
                      {!connected ? (
                        <span className="flex items-center justify-center gap-2">
                          <Wallet className="h-4 w-4" />
                          Connect Wallet
                        </span>
                      ) : isSwapping ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Swapping...
                        </span>
                      ) : isEstimating ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Estimating...
                        </span>
                      ) : !amountFrom ? (
                        "Enter an amount"
                      ) : error ? (
                        "Swap unavailable"
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          Swap <ArrowRight className="h-4 w-4" />
                        </span>
                      )}
                    </button>

                    {/* Info footer */}
                    <p className="text-[10px] text-gray-500 text-center mt-2">Powered by Hyperion DEX • Chart by DexScreener</p>
                  </MagicCard>

                  {/* Popular Pairs Section */}
                  <MagicCard className="p-4 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                    <div className="flex items-center gap-2 mb-3">
                      <Flame className="h-4 w-4 text-orange-400" />
                      <h3 className="text-sm font-medium text-white">Popular Pairs</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { from: "APT", to: "USDC", fromIcon: DEFAULT_TOKENS[0].iconUri, toIcon: DEFAULT_TOKENS[1].iconUri },
                        { from: "APT", to: "USDT", fromIcon: DEFAULT_TOKENS[0].iconUri, toIcon: DEFAULT_TOKENS[2].iconUri },
                        { from: "USDC", to: "USDT", fromIcon: DEFAULT_TOKENS[1].iconUri, toIcon: DEFAULT_TOKENS[2].iconUri },
                        { from: "USDT", to: "APT", fromIcon: DEFAULT_TOKENS[2].iconUri, toIcon: DEFAULT_TOKENS[0].iconUri },
                      ].map((pair, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            const fromToken = DEFAULT_TOKENS.find(t => t.symbol === pair.from);
                            const toToken = DEFAULT_TOKENS.find(t => t.symbol === pair.to);
                            if (fromToken && toToken) {
                              setTokenFrom(fromToken);
                              setTokenTo(toToken);
                              setAmountFrom("");
                              setAmountTo("");
                            }
                          }}
                          className="flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                        >
                          <div className="flex items-center -space-x-1">
                            <img src={pair.fromIcon} alt={pair.from} className="w-5 h-5 rounded-full border border-[#0B1418]" />
                            <img src={pair.toIcon} alt={pair.to} className="w-5 h-5 rounded-full border border-[#0B1418]" />
                          </div>
                          <span className="text-white text-xs font-medium">{pair.from}/{pair.to}</span>
                        </button>
                      ))}
                    </div>
                  </MagicCard>

                </div>
              </div>
            </div>

            {/* Token Selector Modal */}
            {showTokenSelector && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <MagicCard className="w-full max-w-md p-4 rounded-2xl max-h-[80vh] overflow-hidden" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-medium text-white">Select Token</h3>
                    <button
                      onClick={() => setShowTokenSelector(null)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <span className="text-gray-400 text-xl">×</span>
                    </button>
                  </div>

                  <div className="overflow-y-auto max-h-[60vh] space-y-1">
                    {loadingBalances ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 text-[#D4F6D3] animate-spin" />
                      </div>
                    ) : (
                      availableTokens.map((token) => (
                        <button
                          key={token.address}
                          onClick={() => selectToken(token, showTokenSelector)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                            (showTokenSelector === "from" && token.address === tokenFrom.address) ||
                            (showTokenSelector === "to" && token.address === tokenTo.address)
                              ? "bg-[#D4F6D3]/20"
                              : "hover:bg-white/10"
                          }`}
                        >
                          {token.iconUri ? (
                            <img src={token.iconUri} alt={token.symbol} className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                              <span className="text-white font-medium">{token.symbol.charAt(0)}</span>
                            </div>
                          )}
                          <div className="flex-1 text-left">
                            <div className="text-white font-medium">{token.symbol}</div>
                            <div className="text-gray-400 text-sm">{token.name}</div>
                          </div>
                          {token.balance !== undefined && (
                            <div className="text-right">
                              <div className="text-white text-sm">
                                {formatTokenBalance(token.balance, token.decimals)}
                              </div>
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </MagicCard>
              </div>
            )}
          </main>
        </AppSidebar>
      </div>
    </div>
  );
}

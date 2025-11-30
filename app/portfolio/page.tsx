"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";
import { MagicCard } from "@/components/ui/magic-card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet,
  Droplets,
  Lock,
  TrendingUp,
  Coins,
  Clock,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  Calendar,
  PieChart,
  BarChart3,
  Sparkles,
  RefreshCw,
  DollarSign,
  Unlock,
} from "lucide-react";
import Link from "next/link";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  aptos,
  getWalletFungibleAssets,
  formatTokenBalance,
  buildClaimPayload,
  buildWithdrawLockedPayload,
  type WalletToken,
} from "@/lib/lilipadClient";
import { NETWORK } from "@/constants";
import { DefiTooltip } from "@/components/defi-tooltip";

const poppins = Poppins({ weight: ["200", "300", "400", "700"], subsets: ["latin"] });

// Interfaces matching what's stored in localStorage by vesting/locks pages
interface StoredStream {
  id: string;
  beneficiary: string;
  token: string;
  totalAmount: string;
  startTs: number;
  endTs: number;
  claimed: string;
  createdAt: number;
  txHash: string;
  isOwner: boolean;
}

interface StoredLock {
  id: string;
  token: string;
  amount: string;
  unlockTs: number;
  createdAt: number;
  txHash: string;
  withdrawn: boolean;
}

export default function Portfolio() {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [vestingStreams, setVestingStreams] = useState<StoredStream[]>([]);
  const [locks, setLocks] = useState<StoredLock[]>([]);
  const [assets, setAssets] = useState<WalletToken[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [claimingStreamId, setClaimingStreamId] = useState<string | null>(null);
  const [withdrawingLockId, setWithdrawingLockId] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load portfolio data from localStorage (same source as vesting/locks pages)
  useEffect(() => {
    if (connected && account?.address) {
      loadPortfolioData();
    } else {
      setVestingStreams([]);
      setLocks([]);
      setAssets([]);
      setIsLoading(false);
    }
  }, [connected, account?.address]);

  const loadPortfolioData = async () => {
    if (!account?.address) return;
    setIsLoading(true);

    const walletAddress = account.address.toString();

    try {
      // Load localStorage data + blockchain assets in parallel
      const [streamsData, locksData, assetsData] = await Promise.all([
        loadVestingStreamsFromStorage(walletAddress),
        loadLocksFromStorage(walletAddress),
        loadAssets(walletAddress),
      ]);

      setVestingStreams(streamsData);
      setLocks(locksData);
      setAssets(assetsData);
    } catch (e) {
      console.error("Failed to load portfolio:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load vesting streams from localStorage (same as vesting page does)
  const loadVestingStreamsFromStorage = (walletAddress: string): StoredStream[] => {
    try {
      const stored = localStorage.getItem("lilipad_created_streams");
      if (stored) {
        const allStreams: StoredStream[] = JSON.parse(stored);
        // Filter for streams where user is owner or beneficiary
        return allStreams.filter(s =>
          localStorage.getItem(`lilipad_stream_owner_${s.id}`) === walletAddress ||
          s.beneficiary.toLowerCase() === walletAddress.toLowerCase()
        );
      }
    } catch (error) {
      console.error("Failed to load streams from storage:", error);
    }
    return [];
  };

  // Load locks from localStorage (same as locks page does)
  const loadLocksFromStorage = (walletAddress: string): StoredLock[] => {
    try {
      const stored = localStorage.getItem("lilipad_created_locks");
      if (stored) {
        const allLocks: StoredLock[] = JSON.parse(stored);
        // Filter for locks where user is the owner
        return allLocks.filter(l =>
          localStorage.getItem(`lilipad_lock_owner_${l.id}`) === walletAddress
        );
      }
    } catch (error) {
      console.error("Failed to load locks from storage:", error);
    }
    return [];
  };

  const loadAssets = async (walletAddress: string): Promise<WalletToken[]> => {
    try {
      const tokens = await getWalletFungibleAssets(walletAddress);
      return tokens;
    } catch (e) {
      console.error("Failed to load assets:", e);
      return [];
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPortfolioData();
    setIsRefreshing(false);
  };

  // Handle claim vested tokens
  const handleClaim = async (streamId: string) => {
    if (!connected || !account) return;

    setClaimingStreamId(streamId);
    setTxResult(null);

    try {
      // For localStorage-based streams, we use stream index 0 as placeholder
      // In production, you'd extract the on-chain ID from the stream
      const payload = buildClaimPayload(0);
      const response = await signAndSubmitTransaction({ data: payload });
      await aptos.waitForTransaction({ transactionHash: response.hash });

      setTxResult({ success: true, message: "Tokens claimed successfully!" });

      // Refresh data
      await loadPortfolioData();
    } catch (e) {
      console.error("Claim failed:", e);
      setTxResult({
        success: false,
        message: e instanceof Error ? e.message : "Claim failed",
      });
    } finally {
      setClaimingStreamId(null);
    }
  };

  // Handle withdraw locked tokens
  const handleWithdraw = async (lock: StoredLock) => {
    if (!connected || !account) return;

    const now = Math.floor(Date.now() / 1000);
    if (now < lock.unlockTs) {
      setTxResult({ success: false, message: "Lock has not expired yet" });
      return;
    }

    setWithdrawingLockId(lock.id);
    setTxResult(null);

    try {
      // For localStorage-based locks, we use lock index 0 as placeholder
      const payload = buildWithdrawLockedPayload(0);
      const response = await signAndSubmitTransaction({ data: payload });
      await aptos.waitForTransaction({ transactionHash: response.hash });

      // Update localStorage to mark as withdrawn
      const stored = localStorage.getItem("lilipad_created_locks");
      if (stored) {
        const allLocks: StoredLock[] = JSON.parse(stored);
        const updated = allLocks.map(l =>
          l.id === lock.id ? { ...l, withdrawn: true } : l
        );
        localStorage.setItem("lilipad_created_locks", JSON.stringify(updated));
      }

      setTxResult({ success: true, message: "Tokens withdrawn successfully!" });

      // Refresh data
      await loadPortfolioData();
    } catch (e) {
      console.error("Withdraw failed:", e);
      setTxResult({
        success: false,
        message: e instanceof Error ? e.message : "Withdraw failed",
      });
    } finally {
      setWithdrawingLockId(null);
    }
  };

  // Calculate vesting progress and claimable amount for a stream
  const calculateStreamInfo = (stream: StoredStream) => {
    const now = Math.floor(Date.now() / 1000);
    const total = parseFloat(stream.totalAmount) || 0;
    const claimed = parseFloat(stream.claimed) || 0;

    // Calculate progress
    let progress = 0;
    if (now <= stream.startTs) {
      progress = 0;
    } else if (now >= stream.endTs) {
      progress = 100;
    } else {
      progress = Math.round(((now - stream.startTs) / (stream.endTs - stream.startTs)) * 100);
    }

    // Calculate unlocked amount
    let unlocked = 0;
    if (now <= stream.startTs) {
      unlocked = 0;
    } else if (now >= stream.endTs) {
      unlocked = total;
    } else {
      const elapsed = now - stream.startTs;
      const duration = stream.endTs - stream.startTs;
      unlocked = (total * elapsed) / duration;
    }

    const claimable = Math.max(0, unlocked - claimed);

    return { progress, unlocked, claimable, total, claimed };
  };

  // Calculate portfolio stats
  const stats = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);

    // Vesting stats
    const totalVesting = vestingStreams.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || 0), 0);
    const totalClaimed = vestingStreams.reduce((sum, s) => sum + (parseFloat(s.claimed) || 0), 0);
    const totalClaimable = vestingStreams.reduce((sum, s) => {
      const info = calculateStreamInfo(s);
      return sum + info.claimable;
    }, 0);

    // Lock stats
    const activeLocks = locks.filter(l => !l.withdrawn && now < l.unlockTs);
    const totalLocked = activeLocks.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
    const unlockedLocks = locks.filter(l => !l.withdrawn && now >= l.unlockTs);

    // Asset stats
    const totalAssets = assets.length;

    return {
      totalVesting,
      totalClaimed,
      totalClaimable,
      activeStreams: vestingStreams.filter(s => now >= s.startTs && now < s.endTs).length,
      completedStreams: vestingStreams.filter(s => now >= s.endTs).length,
      pendingStreams: vestingStreams.filter(s => now < s.startTs).length,
      totalLocked,
      activeLocks: activeLocks.length,
      unlockedLocks: unlockedLocks.length,
      totalAssets,
    };
  }, [vestingStreams, locks, assets]);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const getExplorerUrl = (hash: string, type: "txn" | "account" = "account") => {
    return `https://explorer.aptoslabs.com/${type}/${hash}?network=${NETWORK}`;
  };

  const formatTimeRemaining = (endTs: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = endTs - now;
    if (diff <= 0) return "Completed";
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const shortenAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const isUnlocked = (unlockTs: number) => {
    return Math.floor(Date.now() / 1000) >= unlockTs;
  };

  // Token icon component with fallback
  const TokenIcon = ({ iconUri, symbol, size = 32 }: { iconUri?: string; symbol: string; size?: number }) => {
    const [hasError, setHasError] = useState(false);

    if (!iconUri || hasError) {
      return (
        <div
          className="rounded-full bg-[#D4F6D3]/20 flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          <Coins className="text-[#D4F6D3]" style={{ width: size * 0.5, height: size * 0.5 }} />
        </div>
      );
    }

    return (
      <img
        src={iconUri}
        alt={symbol}
        width={size}
        height={size}
        className="rounded-full object-cover"
        onError={() => setHasError(true)}
      />
    );
  };

  if (!connected) {
    return (
      <div className={`flex flex-col h-screen w-screen overflow-hidden bg-[url('/image/bg.png')] bg-cover ${poppins.className}`}>
        <Navbar />
        <div className="flex-1 flex overflow-hidden">
          <AppSidebar>
            <main className="flex-1 overflow-auto p-4">
              <SidebarTrigger className="mb-4" />
              <section className="px-4 max-w-4xl mx-auto pb-24">
                <MagicCard
                  className="p-12 rounded-2xl text-center"
                  gradientSize={300}
                  gradientFrom="#d4f6d3"
                  gradientTo="#0b1418"
                >
                  <Wallet className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                  <h2 className="text-2xl font-light text-white mb-3">
                    Connect Your Wallet
                  </h2>
                  <p className="text-gray-400">
                    Connect your wallet to view your portfolio, vesting schedules, locks, and assets
                  </p>
                </MagicCard>
              </section>
            </main>
          </AppSidebar>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden bg-[url('/image/bg.png')] bg-cover ${poppins.className}`}>
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar>
          <main className="flex-1 overflow-auto p-4">
            <SidebarTrigger className="mb-4" />

            <section className="px-4 max-w-6xl mx-auto pb-24">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-4xl font-light text-white">My Portfolio</h1>
                  <p className="text-gray-400 mt-2">
                    Track your vesting schedules, locked tokens, and assets
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
                  </button>
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-gray-400 text-sm">
                      {shortenAddress(account?.address?.toString() || "")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction Result Toast */}
              {txResult && (
                <div
                  className={`mb-6 p-4 rounded-xl border ${
                    txResult.success
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`}
                >
                  <p className="text-sm">{txResult.message}</p>
                </div>
              )}

              {/* Total Portfolio Value Card */}
              <MagicCard
                className="p-6 rounded-2xl mb-8"
                gradientSize={300}
                gradientFrom="#d4f6d3"
                gradientTo="#0b1418"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      <DefiTooltip term="tvl">Portfolio Summary</DefiTooltip>
                    </p>
                    <div className="flex items-baseline gap-4 mt-2">
                      <div>
                        <p className="text-3xl font-light text-white">
                          {stats.totalVesting.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-500">
                          <DefiTooltip term="vesting">Total Vesting</DefiTooltip>
                        </p>
                      </div>
                      <div className="h-8 w-px bg-[#D4F6D3]/20" />
                      <div>
                        <p className="text-3xl font-light text-white">
                          {stats.totalLocked.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-500">
                          <DefiTooltip term="lock">Total Locked</DefiTooltip>
                        </p>
                      </div>
                      <div className="h-8 w-px bg-[#D4F6D3]/20" />
                      <div>
                        <p className="text-3xl font-light text-[#D4F6D3]">
                          {stats.totalClaimable.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-500">
                          <DefiTooltip term="claimable">Claimable Now</DefiTooltip>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Wallet Assets</p>
                    <p className="text-2xl font-medium text-white">{stats.totalAssets}</p>
                    <p className="text-xs text-gray-500">tokens</p>
                  </div>
                </div>
              </MagicCard>

              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <MagicCard
                  className="p-4 rounded-xl"
                  gradientSize={150}
                  gradientFrom="#d4f6d3"
                  gradientTo="#0b1418"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#D4F6D3]/10">
                      <Droplets className="h-5 w-5 text-[#D4F6D3]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Active Vesting</p>
                      <p className="text-lg font-medium text-white">{stats.activeStreams}</p>
                    </div>
                  </div>
                </MagicCard>

                <MagicCard
                  className="p-4 rounded-xl"
                  gradientSize={150}
                  gradientFrom="#d4f6d3"
                  gradientTo="#0b1418"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Sparkles className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">With Claimable</p>
                      <p className="text-lg font-medium text-white">
                        {vestingStreams.filter(s => calculateStreamInfo(s).claimable > 0).length}
                      </p>
                    </div>
                  </div>
                </MagicCard>

                <MagicCard
                  className="p-4 rounded-xl"
                  gradientSize={150}
                  gradientFrom="#d4f6d3"
                  gradientTo="#0b1418"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Lock className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Active Locks</p>
                      <p className="text-lg font-medium text-white">{stats.activeLocks}</p>
                    </div>
                  </div>
                </MagicCard>

                <MagicCard
                  className="p-4 rounded-xl"
                  gradientSize={150}
                  gradientFrom="#d4f6d3"
                  gradientTo="#0b1418"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                      <Unlock className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Ready to Unlock</p>
                      <p className="text-lg font-medium text-white">{stats.unlockedLocks}</p>
                    </div>
                  </div>
                </MagicCard>

                <MagicCard
                  className="p-4 rounded-xl"
                  gradientSize={150}
                  gradientFrom="#d4f6d3"
                  gradientTo="#0b1418"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Coins className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">My Assets</p>
                      <p className="text-lg font-medium text-white">{stats.totalAssets}</p>
                    </div>
                  </div>
                </MagicCard>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
                <TabsList className="bg-[#0B1418] border border-[#D4F6D3]/20 p-1">
                  <TabsTrigger
                    value="overview"
                    className="data-[state=active]:bg-[#D4F6D3] data-[state=active]:text-[#0B1418] text-gray-400"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="vesting"
                    className="data-[state=active]:bg-[#D4F6D3] data-[state=active]:text-[#0B1418] text-gray-400"
                  >
                    <Droplets className="h-4 w-4 mr-2" />
                    Vesting ({vestingStreams.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="locks"
                    className="data-[state=active]:bg-[#D4F6D3] data-[state=active]:text-[#0B1418] text-gray-400"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Locks ({locks.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="assets"
                    className="data-[state=active]:bg-[#D4F6D3] data-[state=active]:text-[#0B1418] text-gray-400"
                  >
                    <Coins className="h-4 w-4 mr-2" />
                    Assets ({assets.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Loading State */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[#D4F6D3] mb-4" />
                  <p className="text-gray-400">Loading your portfolio...</p>
                </div>
              ) : (
                <>
                  {/* Overview Tab */}
                  {activeTab === "overview" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Recent Vesting */}
                      <MagicCard
                        className="p-6 rounded-2xl"
                        gradientSize={200}
                        gradientFrom="#d4f6d3"
                        gradientTo="#0b1418"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-medium text-white flex items-center gap-2">
                            <Droplets className="h-5 w-5 text-[#D4F6D3]" />
                            Vesting Streams
                          </h3>
                          <button
                            onClick={() => setActiveTab("vesting")}
                            className="text-sm text-[#D4F6D3] hover:underline"
                          >
                            View All
                          </button>
                        </div>

                        {vestingStreams.length === 0 ? (
                          <div className="text-center py-8">
                            <Droplets className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400 text-sm">No vesting streams found</p>
                            <p className="text-gray-500 text-xs mt-1">
                              Create a vesting stream or purchase from a fair launch
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {vestingStreams.slice(0, 3).map((stream) => {
                              const info = calculateStreamInfo(stream);
                              return (
                                <div
                                  key={stream.id}
                                  className="p-4 rounded-xl bg-[#0B1418] border border-[#D4F6D3]/10"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-white font-medium">
                                      {info.total.toLocaleString()} tokens
                                    </span>
                                    <span className="text-[#D4F6D3] text-sm">
                                      {info.progress}% vested
                                    </span>
                                  </div>
                                  <Progress
                                    value={info.progress}
                                    className="h-2 mb-2"
                                  />
                                  <div className="flex justify-between text-xs text-gray-500">
                                    <span>{info.claimed.toLocaleString()} claimed</span>
                                    <span>{formatTimeRemaining(stream.endTs)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </MagicCard>

                      {/* Active Locks */}
                      <MagicCard
                        className="p-6 rounded-2xl"
                        gradientSize={200}
                        gradientFrom="#d4f6d3"
                        gradientTo="#0b1418"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-medium text-white flex items-center gap-2">
                            <Lock className="h-5 w-5 text-[#D4F6D3]" />
                            Token Locks
                          </h3>
                          <button
                            onClick={() => setActiveTab("locks")}
                            className="text-sm text-[#D4F6D3] hover:underline"
                          >
                            View All
                          </button>
                        </div>

                        {locks.length === 0 ? (
                          <div className="text-center py-8">
                            <Lock className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400 text-sm">No locked tokens</p>
                            <p className="text-gray-500 text-xs mt-1">
                              Lock your tokens to show commitment
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {locks.slice(0, 3).map((lock) => {
                              const unlocked = isUnlocked(lock.unlockTs);
                              const amount = parseFloat(lock.amount) || 0;
                              return (
                                <div
                                  key={lock.id}
                                  className="p-4 rounded-xl bg-[#0B1418] border border-[#D4F6D3]/10"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-white font-medium">
                                      {amount.toLocaleString()} tokens
                                    </span>
                                    <span className={`text-sm ${lock.withdrawn ? "text-gray-400" : unlocked ? "text-green-400" : "text-yellow-400"}`}>
                                      {lock.withdrawn ? "Withdrawn" : unlocked ? "Unlocked" : "Locked"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">
                                      {shortenAddress(lock.token)}
                                    </span>
                                    <span className="text-gray-500">
                                      {unlocked
                                        ? "Ready to withdraw"
                                        : `Unlocks ${new Date(lock.unlockTs * 1000).toLocaleDateString()}`}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </MagicCard>

                      {/* Assets Preview */}
                      <MagicCard
                        className="p-6 rounded-2xl lg:col-span-2"
                        gradientSize={250}
                        gradientFrom="#d4f6d3"
                        gradientTo="#0b1418"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-medium text-white flex items-center gap-2">
                            <Coins className="h-5 w-5 text-[#D4F6D3]" />
                            My Assets
                          </h3>
                          <button
                            onClick={() => setActiveTab("assets")}
                            className="text-sm text-[#D4F6D3] hover:underline"
                          >
                            View All
                          </button>
                        </div>

                        {assets.length === 0 ? (
                          <div className="text-center py-8">
                            <Coins className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400 text-sm">No fungible assets found</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {assets.slice(0, 4).map((asset) => (
                              <div
                                key={asset.id}
                                className="p-4 rounded-xl bg-[#0B1418] border border-[#D4F6D3]/10"
                              >
                                <div className="flex items-center gap-3 mb-2">
                                  <TokenIcon iconUri={asset.iconUri} symbol={asset.symbol} size={32} />
                                  <div>
                                    <p className="text-white font-medium text-sm">{asset.symbol}</p>
                                    <p className="text-gray-500 text-xs">{asset.name}</p>
                                  </div>
                                </div>
                                <p className="text-white font-medium">
                                  {formatTokenBalance(asset.balance, asset.decimals)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </MagicCard>
                    </div>
                  )}

                  {/* Vesting Tab */}
                  {activeTab === "vesting" && (
                    <div className="space-y-4">
                      {vestingStreams.length === 0 ? (
                        <MagicCard
                          className="p-12 rounded-2xl text-center"
                          gradientSize={300}
                          gradientFrom="#d4f6d3"
                          gradientTo="#0b1418"
                        >
                          <Droplets className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                          <h2 className="text-2xl font-light text-white mb-3">
                            No <DefiTooltip term="vesting">Vesting Streams</DefiTooltip>
                          </h2>
                          <p className="text-gray-400 mb-6">
                            Create a vesting stream or purchase from a fair launch
                          </p>
                          <div className="flex gap-3 justify-center">
                            <Link
                              href="/vesting"
                              className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                            >
                              <Droplets className="h-5 w-5" />
                              Create Stream
                            </Link>
                            <Link
                              href="/launch"
                              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0B1418] border border-[#D4F6D3]/30 text-white rounded-xl font-medium hover:border-[#D4F6D3]/50 transition-colors"
                            >
                              <TrendingUp className="h-5 w-5" />
                              Browse Launches
                            </Link>
                          </div>
                        </MagicCard>
                      ) : (
                        vestingStreams.map((stream) => {
                          const info = calculateStreamInfo(stream);
                          const hasClaimable = info.claimable > 0;
                          const isClaiming = claimingStreamId === stream.id;
                          const isBeneficiary = account?.address?.toString().toLowerCase() === stream.beneficiary.toLowerCase();

                          return (
                            <MagicCard
                              key={stream.id}
                              className="p-6 rounded-2xl"
                              gradientSize={200}
                              gradientFrom="#d4f6d3"
                              gradientTo="#0b1418"
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div>
                                  <h3 className="text-xl font-medium text-white flex items-center gap-2">
                                    <DefiTooltip term="linearVesting">
                                      {info.total.toLocaleString()} tokens
                                    </DefiTooltip>
                                  </h3>
                                  <p className="text-sm text-gray-400 mt-1">
                                    {isBeneficiary ? "You are the beneficiary" : "You created this stream"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {hasClaimable && isBeneficiary && (
                                    <button
                                      onClick={() => handleClaim(stream.id)}
                                      disabled={isClaiming}
                                      className="px-4 py-2 bg-[#D4F6D3] text-[#0B1418] rounded-lg font-medium hover:bg-[#c2e8c1] transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                      {isClaiming ? (
                                        <>
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          Claiming...
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="h-4 w-4" />
                                          Claim
                                        </>
                                      )}
                                    </button>
                                  )}
                                  <a
                                    href={getExplorerUrl(stream.txHash, "txn")}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white transition-colors"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </div>
                              </div>

                              <div className="mb-4">
                                <div className="flex justify-between text-sm mb-2">
                                  <span className="text-gray-400">Progress</span>
                                  <span className="text-white">{info.progress}% vested</span>
                                </div>
                                <Progress value={info.progress} className="h-3" />
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-500">Total Amount</p>
                                  <p className="text-white font-medium">
                                    {info.total.toLocaleString()}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Claimed</p>
                                  <p className="text-white font-medium">
                                    {info.claimed.toLocaleString()}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500">
                                    <DefiTooltip term="claimable">Claimable Now</DefiTooltip>
                                  </p>
                                  <p className={`font-medium ${hasClaimable ? "text-[#D4F6D3]" : "text-white"}`}>
                                    {info.claimable.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Time Remaining</p>
                                  <p className="text-white font-medium">
                                    {formatTimeRemaining(stream.endTs)}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 pt-4 border-t border-[#D4F6D3]/10 flex items-center justify-between text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Started: {new Date(stream.startTs * 1000).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Ends: {new Date(stream.endTs * 1000).toLocaleDateString()}
                                </span>
                              </div>
                            </MagicCard>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Locks Tab */}
                  {activeTab === "locks" && (
                    <div className="space-y-4">
                      {locks.length === 0 ? (
                        <MagicCard
                          className="p-12 rounded-2xl text-center"
                          gradientSize={300}
                          gradientFrom="#d4f6d3"
                          gradientTo="#0b1418"
                        >
                          <Lock className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                          <h2 className="text-2xl font-light text-white mb-3">
                            No <DefiTooltip term="lock">Locked Tokens</DefiTooltip>
                          </h2>
                          <p className="text-gray-400 mb-6">
                            Lock your tokens to demonstrate long-term commitment
                          </p>
                          <Link
                            href="/locks"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                          >
                            <Lock className="h-5 w-5" />
                            Create Lock
                          </Link>
                        </MagicCard>
                      ) : (
                        locks.map((lock) => {
                          const unlocked = isUnlocked(lock.unlockTs);
                          const canWithdraw = unlocked && !lock.withdrawn;
                          const isWithdrawing = withdrawingLockId === lock.id;
                          const amount = parseFloat(lock.amount) || 0;

                          return (
                            <MagicCard
                              key={lock.id}
                              className="p-6 rounded-2xl"
                              gradientSize={200}
                              gradientFrom="#d4f6d3"
                              gradientTo="#0b1418"
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div>
                                  <h3 className="text-xl font-medium text-white flex items-center gap-2">
                                    <DefiTooltip term="lock">
                                      {amount.toLocaleString()} tokens
                                    </DefiTooltip>
                                  </h3>
                                  <p className="text-sm text-gray-400 mt-1">
                                    Time-based Token Lock
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                    lock.withdrawn
                                      ? "bg-gray-500/20 text-gray-400"
                                      : unlocked
                                      ? "bg-green-500/20 text-green-400"
                                      : "bg-yellow-500/20 text-yellow-400"
                                  }`}>
                                    {lock.withdrawn ? "Withdrawn" : unlocked ? "Unlocked" : "Locked"}
                                  </span>
                                  {canWithdraw && (
                                    <button
                                      onClick={() => handleWithdraw(lock)}
                                      disabled={isWithdrawing}
                                      className="px-4 py-2 bg-[#D4F6D3] text-[#0B1418] rounded-lg font-medium hover:bg-[#c2e8c1] transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                      {isWithdrawing ? (
                                        <>
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          Withdrawing...
                                        </>
                                      ) : (
                                        "Withdraw"
                                      )}
                                    </button>
                                  )}
                                  <a
                                    href={getExplorerUrl(lock.txHash, "txn")}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white transition-colors"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-500">Amount Locked</p>
                                  <p className="text-white font-medium">
                                    {amount.toLocaleString()}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Unlock Date</p>
                                  <p className="text-white font-medium">
                                    {new Date(lock.unlockTs * 1000).toLocaleDateString()}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Status</p>
                                  <p className={`font-medium ${
                                    lock.withdrawn ? "text-gray-400" : unlocked ? "text-green-400" : "text-yellow-400"
                                  }`}>
                                    {lock.withdrawn ? "Withdrawn" : unlocked ? "Ready to Withdraw" : formatTimeRemaining(lock.unlockTs)}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 pt-4 border-t border-[#D4F6D3]/10">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">Token Address</span>
                                  <div className="flex items-center gap-2">
                                    <code className="text-gray-400 font-mono">
                                      {shortenAddress(lock.token)}
                                    </code>
                                    <button
                                      onClick={() => copyToClipboard(lock.token)}
                                      className="p-1 rounded bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white transition-all"
                                    >
                                      {copiedAddress === lock.token ? (
                                        <Check className="h-3 w-3 text-green-400" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </MagicCard>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Assets Tab */}
                  {activeTab === "assets" && (
                    <div className="space-y-4">
                      {assets.length === 0 ? (
                        <MagicCard
                          className="p-12 rounded-2xl text-center"
                          gradientSize={300}
                          gradientFrom="#d4f6d3"
                          gradientTo="#0b1418"
                        >
                          <Coins className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                          <h2 className="text-2xl font-light text-white mb-3">
                            No Assets Found
                          </h2>
                          <p className="text-gray-400 mb-6">
                            Your fungible assets will appear here
                          </p>
                          <Link
                            href="/tokens"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                          >
                            <Coins className="h-5 w-5" />
                            Create Token
                          </Link>
                        </MagicCard>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {assets.map((asset) => (
                            <MagicCard
                              key={asset.id}
                              className="p-6 rounded-2xl"
                              gradientSize={200}
                              gradientFrom="#d4f6d3"
                              gradientTo="#0b1418"
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <TokenIcon iconUri={asset.iconUri} symbol={asset.symbol} size={48} />
                                  <div>
                                    <h3 className="text-lg font-medium text-white">{asset.symbol}</h3>
                                    <p className="text-sm text-gray-400">{asset.name}</p>
                                  </div>
                                </div>
                                <a
                                  href={getExplorerUrl(asset.metadata)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white transition-colors"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Balance</p>
                                  <p className="text-2xl font-medium text-white">
                                    {formatTokenBalance(asset.balance, asset.decimals)}
                                  </p>
                                </div>

                                <div className="pt-3 border-t border-[#D4F6D3]/10">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500">Decimals: {asset.decimals}</span>
                                    <div className="flex items-center gap-2">
                                      <code className="text-gray-400 font-mono">
                                        {shortenAddress(asset.metadata)}
                                      </code>
                                      <button
                                        onClick={() => copyToClipboard(asset.metadata)}
                                        className="p-1 rounded bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white transition-all"
                                      >
                                        {copiedAddress === asset.metadata ? (
                                          <Check className="h-3 w-3 text-green-400" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </MagicCard>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </main>
        </AppSidebar>
      </div>
    </div>
  );
}

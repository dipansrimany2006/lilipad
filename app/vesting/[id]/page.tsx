"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";
import { MagicCard } from "@/components/ui/magic-card";
import {
  Droplets,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Calendar,
  Timer,
  TrendingUp,
  PieChart,
  BarChart3,
  Activity,
  Coins,
  User,
  AlertCircle,
  Wallet,
  ArrowDownToLine,
  CircleDollarSign,
} from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  buildClaimPayload,
  aptos,
} from "@/lib/lilipadClient";
import { NETWORK } from "@/constants";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const poppins = Poppins({ weight: ["200", "300", "400", "700"], subsets: ["latin"] });

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

export default function StreamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { account, signAndSubmitTransaction, connected } = useWallet();
  const [stream, setStream] = useState<StoredStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; message: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second for live progress
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load stream from localStorage
  useEffect(() => {
    const loadStream = () => {
      try {
        const stored = localStorage.getItem("lilipad_created_streams");
        if (stored && params.id) {
          const allStreams: StoredStream[] = JSON.parse(stored);
          const decodedId = decodeURIComponent(params.id as string);
          const foundStream = allStreams.find(s => s.id === decodedId);
          if (foundStream) {
            setStream(foundStream);
          }
        }
      } catch (error) {
        console.error("Failed to load stream:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStream();
  }, [params.id]);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const getExplorerUrl = (txHash: string) => {
    return `https://explorer.aptoslabs.com/txn/${txHash}?network=${NETWORK}`;
  };

  const shortenAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleClaim = async () => {
    if (!connected || !account || !stream) return;

    const walletAddress = account.address.toString();
    if (stream.beneficiary.toLowerCase() !== walletAddress.toLowerCase()) {
      setTxResult({ success: false, message: "Only the beneficiary can claim" });
      return;
    }

    setClaiming(true);

    try {
      const payload = buildClaimPayload(0);

      const response = await signAndSubmitTransaction({
        data: payload,
      });

      await aptos.waitForTransaction({
        transactionHash: response.hash,
      });

      setTxResult({ success: true, message: "Tokens claimed successfully!" });
    } catch (error: unknown) {
      console.error("Claim failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Claim failed";
      setTxResult({ success: false, message: errorMessage });
    } finally {
      setClaiming(false);
    }
  };

  // Calculate analytics data
  const analytics = useMemo(() => {
    if (!stream) return null;

    const now = Math.floor(currentTime / 1000);
    const total = parseFloat(stream.totalAmount) || 0;
    const claimed = parseFloat(stream.claimed) || 0;
    const totalDuration = stream.endTs - stream.startTs;
    const elapsed = Math.max(0, Math.min(now - stream.startTs, totalDuration));
    const remaining = Math.max(0, stream.endTs - now);

    // Calculate unlocked amount (linear vesting)
    let unlocked: number;
    if (now <= stream.startTs) {
      unlocked = 0;
    } else if (now >= stream.endTs) {
      unlocked = total;
    } else {
      unlocked = (total * (now - stream.startTs)) / totalDuration;
    }

    const claimable = unlocked - claimed;
    const locked = total - unlocked;

    // Progress percentages
    const vestingProgress = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 0;
    const claimedPercent = total > 0 ? (claimed / total) * 100 : 0;
    const unlockedPercent = total > 0 ? (unlocked / total) * 100 : 0;

    // Time breakdown
    const remainingDays = Math.floor(remaining / 86400);
    const remainingHours = Math.floor((remaining % 86400) / 3600);
    const remainingMinutes = Math.floor((remaining % 3600) / 60);

    // Generate vesting schedule data for chart
    const vestingSchedule = [];
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const timestamp = stream.startTs + (totalDuration * i) / steps;
      const date = new Date(timestamp * 1000);
      const stepElapsed = Math.max(0, Math.min(timestamp - stream.startTs, totalDuration));
      const stepUnlocked = totalDuration > 0 ? (total * stepElapsed) / totalDuration : 0;

      vestingSchedule.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        timestamp,
        unlocked: stepUnlocked,
        total: total,
        percentage: total > 0 ? (stepUnlocked / total) * 100 : 0,
      });
    }

    // Token distribution for pie chart
    const tokenDistribution = [
      { name: "Claimed", value: claimed, fill: "#22c55e" },
      { name: "Claimable", value: claimable, fill: "#D4F6D3" },
      { name: "Locked", value: locked, fill: "#1f2937" },
    ].filter(item => item.value > 0);

    // Release rate per day
    const dailyRelease = totalDuration > 0 ? total / (totalDuration / 86400) : 0;
    const hourlyRelease = totalDuration > 0 ? total / (totalDuration / 3600) : 0;

    // Milestone data
    const milestones = [
      { percent: 25, date: new Date((stream.startTs + totalDuration * 0.25) * 1000), reached: vestingProgress >= 25 },
      { percent: 50, date: new Date((stream.startTs + totalDuration * 0.5) * 1000), reached: vestingProgress >= 50 },
      { percent: 75, date: new Date((stream.startTs + totalDuration * 0.75) * 1000), reached: vestingProgress >= 75 },
      { percent: 100, date: new Date(stream.endTs * 1000), reached: vestingProgress >= 100 },
    ];

    // Weekly release projection
    const weeklyProjection = [];
    const weeksRemaining = Math.ceil(remaining / (7 * 86400));
    for (let i = 0; i < Math.min(weeksRemaining, 8); i++) {
      const weekStart = now + i * 7 * 86400;
      const weekEnd = Math.min(weekStart + 7 * 86400, stream.endTs);
      const weekDuration = weekEnd - weekStart;
      const weekAmount = totalDuration > 0 ? (total * weekDuration) / totalDuration : 0;
      weeklyProjection.push({
        week: `Week ${i + 1}`,
        amount: weekAmount,
        cumulative: unlocked + weekAmount * (i + 1),
      });
    }

    return {
      total,
      claimed,
      unlocked,
      claimable,
      locked,
      totalDuration,
      elapsed,
      remaining,
      vestingProgress,
      claimedPercent,
      unlockedPercent,
      remainingDays,
      remainingHours,
      remainingMinutes,
      vestingSchedule,
      tokenDistribution,
      dailyRelease,
      hourlyRelease,
      milestones,
      weeklyProjection,
    };
  }, [stream, currentTime]);

  const isBeneficiary = account?.address && stream?.beneficiary.toLowerCase() === account.address.toString().toLowerCase();

  const chartConfig = {
    unlocked: {
      label: "Unlocked",
      color: "#D4F6D3",
    },
    claimed: {
      label: "Claimed",
      color: "#22c55e",
    },
    claimable: {
      label: "Claimable",
      color: "#a8e6a3",
    },
    locked: {
      label: "Locked",
      color: "#1f2937",
    },
  };

  if (loading) {
    return (
      <div className={`flex flex-col h-screen w-screen overflow-hidden bg-[url('/image/bg.png')] bg-cover ${poppins.className}`}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#D4F6D3]" />
        </div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className={`flex flex-col h-screen w-screen overflow-hidden bg-[url('/image/bg.png')] bg-cover ${poppins.className}`}>
        <Navbar />
        <div className="flex-1 flex overflow-hidden">
          <AppSidebar>
            <main className="flex-1 overflow-auto p-4">
              <SidebarTrigger className="mb-4" />
              <section className="px-4 max-w-6xl mx-auto">
                <MagicCard
                  className="p-12 rounded-2xl text-center"
                  gradientSize={300}
                  gradientFrom="#d4f6d3"
                  gradientTo="#0b1418"
                >
                  <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-6" />
                  <h2 className="text-2xl font-light text-white mb-3">Stream Not Found</h2>
                  <p className="text-gray-400 mb-6">The vesting stream you're looking for doesn't exist or has been removed.</p>
                  <button
                    onClick={() => router.push('/vesting')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5" />
                    Back to Vesting
                  </button>
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

            <section className="px-4 max-w-6xl mx-auto pb-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => router.push('/vesting')}
                    className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h1 className="text-3xl font-light text-white">Stream Analytics</h1>
                    <p className="text-gray-400 text-sm">Detailed view of your vesting stream</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isBeneficiary && analytics && analytics.claimable > 0 && (
                    <button
                      onClick={handleClaim}
                      disabled={claiming}
                      className="flex items-center gap-2 px-6 py-3 bg-[#D4F6D3]/20 text-[#D4F6D3] rounded-xl font-medium hover:bg-[#D4F6D3]/30 transition-colors disabled:opacity-50"
                    >
                      {claiming ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <ArrowDownToLine className="h-5 w-5" />
                      )}
                      Claim {analytics.claimable.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens
                    </button>
                  )}
                  <a
                    href={getExplorerUrl(stream.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 rounded-xl hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                  >
                    <ExternalLink className="h-5 w-5" />
                    Explorer
                  </a>
                </div>
              </div>

              {/* Transaction Result */}
              {txResult && (
                <div className={`mb-6 p-4 rounded-xl border ${
                  txResult.success
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}>
                  <p className="text-sm break-all">{txResult.message}</p>
                </div>
              )}

              {/* Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <MagicCard className="p-6 rounded-2xl" gradientSize={150} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#D4F6D3]/20 flex items-center justify-center">
                      <Coins className="h-5 w-5 text-[#D4F6D3]" />
                    </div>
                    <span className="text-gray-400 text-sm">Total Amount</span>
                  </div>
                  <p className="text-xl font-medium text-white">
                    {analytics ? analytics.total.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'} tokens
                  </p>
                </MagicCard>

                <MagicCard className="p-6 rounded-2xl" gradientSize={150} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="h-5 w-5 text-green-400" />
                    </div>
                    <span className="text-gray-400 text-sm">Claimed</span>
                  </div>
                  <p className="text-xl font-medium text-green-400">
                    {analytics ? analytics.claimed.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'} tokens
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{analytics ? Math.round(analytics.claimedPercent) : 0}% of total</p>
                </MagicCard>

                <MagicCard className="p-6 rounded-2xl" gradientSize={150} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#D4F6D3]/20 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-[#D4F6D3]" />
                    </div>
                    <span className="text-gray-400 text-sm">Claimable</span>
                  </div>
                  <p className="text-xl font-medium text-[#D4F6D3]">
                    {analytics ? analytics.claimable.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'} tokens
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Ready to claim now</p>
                </MagicCard>

                <MagicCard className="p-6 rounded-2xl" gradientSize={150} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#D4F6D3]/20 flex items-center justify-center">
                      <Timer className="h-5 w-5 text-[#D4F6D3]" />
                    </div>
                    <span className="text-gray-400 text-sm">Time Remaining</span>
                  </div>
                  {analytics && analytics.remaining > 0 ? (
                    <p className="text-xl font-medium text-white">
                      {analytics.remainingDays}d {analytics.remainingHours}h {analytics.remainingMinutes}m
                    </p>
                  ) : (
                    <p className="text-xl font-medium text-green-400">Fully Vested</p>
                  )}
                </MagicCard>
              </div>

              {/* Progress Bars */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <MagicCard className="p-6 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex justify-between text-sm text-gray-400 mb-3">
                    <span>Vesting Progress</span>
                    <span>{analytics ? Math.round(analytics.vestingProgress) : 0}%</span>
                  </div>
                  <Progress
                    value={analytics?.vestingProgress || 0}
                    className="h-4 bg-[#0B1418]"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-3">
                    <span>Start: {new Date(stream.startTs * 1000).toLocaleDateString()}</span>
                    <span>End: {new Date(stream.endTs * 1000).toLocaleDateString()}</span>
                  </div>
                </MagicCard>

                <MagicCard className="p-6 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex justify-between text-sm text-gray-400 mb-3">
                    <span>Tokens Unlocked</span>
                    <span>{analytics ? Math.round(analytics.unlockedPercent) : 0}%</span>
                  </div>
                  <div className="h-4 bg-[#0B1418] rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${analytics?.claimedPercent || 0}%` }}
                    />
                    <div
                      className="h-full bg-[#D4F6D3] transition-all"
                      style={{ width: `${(analytics?.unlockedPercent || 0) - (analytics?.claimedPercent || 0)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" /> Claimed
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#D4F6D3]" /> Claimable
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#1f2937]" /> Locked
                    </span>
                  </div>
                </MagicCard>
              </div>

              {/* Release Rate Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <MagicCard className="p-6 rounded-2xl" gradientSize={150} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex items-center gap-3 mb-3">
                    <CircleDollarSign className="h-5 w-5 text-[#D4F6D3]" />
                    <span className="text-gray-400 text-sm">Daily Release Rate</span>
                  </div>
                  <p className="text-xl font-medium text-white">
                    {analytics ? Math.round(analytics.dailyRelease).toLocaleString() : '0'} tokens/day
                  </p>
                </MagicCard>

                <MagicCard className="p-6 rounded-2xl" gradientSize={150} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex items-center gap-3 mb-3">
                    <TrendingUp className="h-5 w-5 text-[#D4F6D3]" />
                    <span className="text-gray-400 text-sm">Hourly Release Rate</span>
                  </div>
                  <p className="text-xl font-medium text-white">
                    {analytics ? Math.round(analytics.hourlyRelease).toLocaleString() : '0'} tokens/hr
                  </p>
                </MagicCard>

                <MagicCard className="p-6 rounded-2xl" gradientSize={150} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex items-center gap-3 mb-3">
                    <Calendar className="h-5 w-5 text-[#D4F6D3]" />
                    <span className="text-gray-400 text-sm">Vesting Duration</span>
                  </div>
                  <p className="text-xl font-medium text-white">
                    {analytics ? Math.ceil(analytics.totalDuration / 86400) : '0'} days
                  </p>
                </MagicCard>
              </div>

              {/* Charts Section */}
              <Tabs defaultValue="schedule" className="mb-8">
                <TabsList className="bg-[#0B1418] border border-[#D4F6D3]/20 mb-6">
                  <TabsTrigger value="schedule" className="data-[state=active]:bg-[#D4F6D3]/20 data-[state=active]:text-[#D4F6D3]">
                    <Activity className="h-4 w-4 mr-2" />
                    Vesting Schedule
                  </TabsTrigger>
                  <TabsTrigger value="distribution" className="data-[state=active]:bg-[#D4F6D3]/20 data-[state=active]:text-[#D4F6D3]">
                    <PieChart className="h-4 w-4 mr-2" />
                    Distribution
                  </TabsTrigger>
                  <TabsTrigger value="milestones" className="data-[state=active]:bg-[#D4F6D3]/20 data-[state=active]:text-[#D4F6D3]">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Milestones
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="schedule">
                  <MagicCard className="p-6 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                    <h3 className="text-lg font-medium text-white mb-4">Vesting Schedule</h3>
                    <p className="text-gray-400 text-sm mb-6">Linear token release over the vesting period</p>
                    <ChartContainer config={chartConfig} className="h-[350px] w-full">
                      <AreaChart data={analytics?.vestingSchedule || []}>
                        <defs>
                          <linearGradient id="unlockedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#D4F6D3" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#D4F6D3" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#D4F6D3" strokeOpacity={0.1} />
                        <XAxis
                          dataKey="date"
                          stroke="#6b7280"
                          fontSize={12}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#6b7280"
                          fontSize={12}
                          tickLine={false}
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                        />
                        <ChartTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-[#0B1418] border border-[#D4F6D3]/20 rounded-lg p-3 shadow-lg">
                                  <p className="text-gray-400 text-xs">{payload[0].payload.date}</p>
                                  <p className="text-white font-medium">
                                    {Number(payload[0].value).toLocaleString()} tokens unlocked
                                  </p>
                                  <p className="text-[#D4F6D3] text-sm">
                                    {payload[0].payload.percentage}% of total
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="unlocked"
                          stroke="#D4F6D3"
                          fill="url(#unlockedGradient)"
                          strokeWidth={2}
                        />
                        <ReferenceLine
                          x={new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          stroke="#22c55e"
                          strokeDasharray="3 3"
                          label={{ value: 'Today', position: 'top', fill: '#22c55e', fontSize: 12 }}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </MagicCard>
                </TabsContent>

                <TabsContent value="distribution">
                  <MagicCard className="p-6 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                    <h3 className="text-lg font-medium text-white mb-4">Token Distribution</h3>
                    <p className="text-gray-400 text-sm mb-6">Current breakdown of claimed, claimable, and locked tokens</p>
                    <div className="h-[350px] w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={analytics?.tokenDistribution || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={120}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
                            labelLine={{ stroke: '#6b7280' }}
                          >
                            {analytics?.tokenDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-6">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Claimed</p>
                        <p className="text-lg font-medium text-green-400">
                          {analytics ? analytics.claimed.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Claimable</p>
                        <p className="text-lg font-medium text-[#D4F6D3]">
                          {analytics ? analytics.claimable.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Locked</p>
                        <p className="text-lg font-medium text-gray-400">
                          {analytics ? analytics.locked.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'}
                        </p>
                      </div>
                    </div>
                  </MagicCard>
                </TabsContent>

                <TabsContent value="milestones">
                  <MagicCard className="p-6 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                    <h3 className="text-lg font-medium text-white mb-4">Vesting Milestones</h3>
                    <p className="text-gray-400 text-sm mb-6">Track your progress through key vesting milestones</p>
                    <div className="space-y-6">
                      {analytics?.milestones.map((milestone, index) => (
                        <div key={index} className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            milestone.reached ? 'bg-green-500/20' : 'bg-[#0B1418]'
                          } border ${milestone.reached ? 'border-green-500/50' : 'border-[#D4F6D3]/20'}`}>
                            {milestone.reached ? (
                              <Check className="h-6 w-6 text-green-400" />
                            ) : (
                              <span className="text-gray-400 font-medium">{milestone.percent}%</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-2">
                              <span className={`font-medium ${milestone.reached ? 'text-green-400' : 'text-white'}`}>
                                {milestone.percent}% Vested
                              </span>
                              <span className="text-gray-400 text-sm">
                                {milestone.date.toLocaleDateString()}
                              </span>
                            </div>
                            <Progress
                              value={milestone.reached ? 100 : Math.min(100, (analytics.vestingProgress / milestone.percent) * 100)}
                              className="h-2 bg-[#0B1418]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </MagicCard>
                </TabsContent>
              </Tabs>

              {/* Stream Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MagicCard className="p-6 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-[#D4F6D3]" />
                    Participant Details
                  </h3>
                  <div className="space-y-4">
                    <div className="py-3 border-b border-[#D4F6D3]/10">
                      <span className="text-gray-400 text-sm block mb-1">Beneficiary</span>
                      <div className="flex items-center gap-2">
                        <code className="text-white text-sm font-mono truncate flex-1">{stream.beneficiary}</code>
                        {isBeneficiary && (
                          <span className="text-xs bg-[#D4F6D3]/20 text-[#D4F6D3] px-2 py-0.5 rounded">You</span>
                        )}
                        <button
                          onClick={() => copyToClipboard(stream.beneficiary)}
                          className="p-1.5 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                        >
                          {copiedAddress === stream.beneficiary ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="py-3">
                      <span className="text-gray-400 text-sm block mb-1">Stream Owner</span>
                      <p className="text-white text-sm">
                        {stream.isOwner ? "You created this stream" : "Created by another wallet"}
                      </p>
                    </div>
                  </div>
                </MagicCard>

                <MagicCard className="p-6 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <Coins className="h-5 w-5 text-[#D4F6D3]" />
                    Token Details
                  </h3>
                  <div className="space-y-4">
                    <div className="py-3 border-b border-[#D4F6D3]/10">
                      <span className="text-gray-400 text-sm block mb-1">Token Address</span>
                      <div className="flex items-center gap-2">
                        <code className="text-white text-sm font-mono truncate flex-1">{stream.token}</code>
                        <button
                          onClick={() => copyToClipboard(stream.token)}
                          className="p-1.5 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                        >
                          {copiedAddress === stream.token ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="py-3 border-b border-[#D4F6D3]/10">
                      <span className="text-gray-400 text-sm block mb-1">Transaction Hash</span>
                      <div className="flex items-center gap-2">
                        <code className="text-white text-sm font-mono truncate flex-1">{stream.txHash}</code>
                        <button
                          onClick={() => copyToClipboard(stream.txHash)}
                          className="p-1.5 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                        >
                          {copiedAddress === stream.txHash ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="py-3">
                      <span className="text-gray-400 text-sm block mb-1">Stream ID</span>
                      <code className="text-white text-sm font-mono break-all">{stream.id}</code>
                    </div>
                  </div>
                </MagicCard>
              </div>
            </section>
          </main>
        </AppSidebar>
      </div>
    </div>
  );
}

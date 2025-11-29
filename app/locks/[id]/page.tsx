"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";
import { MagicCard } from "@/components/ui/magic-card";
import {
  Lock,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Unlock,
  Calendar,
  Timer,
  TrendingUp,
  PieChart,
  BarChart3,
  Activity,
  Coins,
  Shield,
  AlertCircle,
} from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  buildWithdrawLockedPayload,
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
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const poppins = Poppins({ weight: ["200", "300", "400", "700"], subsets: ["latin"] });

interface StoredLock {
  id: string;
  token: string;
  amount: string;
  unlockTs: number;
  createdAt: number;
  txHash: string;
  withdrawn: boolean;
}

export default function LockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { account, signAndSubmitTransaction, connected } = useWallet();
  const [lock, setLock] = useState<StoredLock | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; message: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load lock from localStorage
  useEffect(() => {
    const loadLock = () => {
      try {
        const stored = localStorage.getItem("lilipad_created_locks");
        if (stored && params.id) {
          const allLocks: StoredLock[] = JSON.parse(stored);
          const decodedId = decodeURIComponent(params.id as string);
          const foundLock = allLocks.find(l => l.id === decodedId);
          if (foundLock) {
            setLock(foundLock);
          }
        }
      } catch (error) {
        console.error("Failed to load lock:", error);
      } finally {
        setLoading(false);
      }
    };

    loadLock();
  }, [params.id]);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const getExplorerUrl = (txHash: string) => {
    return `https://explorer.aptoslabs.com/txn/${txHash}?network=${NETWORK}`;
  };

  const isUnlocked = (unlockTs: number) => {
    return Math.floor(currentTime / 1000) >= unlockTs;
  };

  const handleWithdraw = async () => {
    if (!connected || !account || !lock) return;

    const now = Math.floor(Date.now() / 1000);
    if (now < lock.unlockTs) {
      setTxResult({ success: false, message: "Lock has not expired yet" });
      return;
    }

    setWithdrawing(true);

    try {
      const payload = buildWithdrawLockedPayload(0);

      const response = await signAndSubmitTransaction({
        data: payload,
      });

      await aptos.waitForTransaction({
        transactionHash: response.hash,
      });

      // Update localStorage
      const stored = localStorage.getItem("lilipad_created_locks");
      if (stored) {
        const allLocks: StoredLock[] = JSON.parse(stored);
        const updated = allLocks.map(l =>
          l.id === lock.id ? { ...l, withdrawn: true } : l
        );
        localStorage.setItem("lilipad_created_locks", JSON.stringify(updated));
        setLock({ ...lock, withdrawn: true });
      }

      setTxResult({ success: true, message: "Tokens withdrawn successfully!" });
    } catch (error: unknown) {
      console.error("Withdraw failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Withdraw failed";
      setTxResult({ success: false, message: errorMessage });
    } finally {
      setWithdrawing(false);
    }
  };

  // Calculate analytics data
  const analytics = useMemo(() => {
    if (!lock) return null;

    const now = Math.floor(currentTime / 1000);
    const createdAt = Math.floor(lock.createdAt / 1000);
    const totalDuration = lock.unlockTs - createdAt;
    const elapsed = Math.max(0, now - createdAt);
    const remaining = Math.max(0, lock.unlockTs - now);
    const progressPercent = Math.min(100, (elapsed / totalDuration) * 100);

    // Time breakdown
    const remainingDays = Math.floor(remaining / 86400);
    const remainingHours = Math.floor((remaining % 86400) / 3600);
    const remainingMinutes = Math.floor((remaining % 3600) / 60);
    const remainingSeconds = remaining % 60;

    // Generate timeline data for chart
    const timelineData = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const timestamp = createdAt + (totalDuration * i) / steps;
      const date = new Date(timestamp * 1000);
      const isLocked = timestamp < lock.unlockTs;
      timelineData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        timestamp,
        status: isLocked ? 100 : 0,
        statusLabel: isLocked ? 'Locked' : 'Unlocked',
      });
    }

    // Status distribution for pie chart
    const statusData = lock.withdrawn
      ? [
          { name: "Withdrawn", value: 100, fill: "#6b7280" },
        ]
      : isUnlocked(lock.unlockTs)
      ? [
          { name: "Ready to Withdraw", value: 100, fill: "#22c55e" },
        ]
      : [
          { name: "Time Elapsed", value: progressPercent, fill: "#D4F6D3" },
          { name: "Time Remaining", value: 100 - progressPercent, fill: "#1f2937" },
        ];

    // Daily countdown breakdown
    const countdownBreakdown = [
      { label: "Days", value: remainingDays, max: Math.ceil(totalDuration / 86400), fill: "#D4F6D3" },
      { label: "Hours", value: remainingHours, max: 24, fill: "#a8e6a3" },
      { label: "Minutes", value: remainingMinutes, max: 60, fill: "#7dd87d" },
      { label: "Seconds", value: remainingSeconds, max: 60, fill: "#52ca52" },
    ];

    return {
      totalDuration,
      elapsed,
      remaining,
      progressPercent,
      remainingDays,
      remainingHours,
      remainingMinutes,
      remainingSeconds,
      timelineData,
      statusData,
      countdownBreakdown,
    };
  }, [lock, currentTime]);

  const chartConfig = {
    status: {
      label: "Lock Status",
      color: "#D4F6D3",
    },
    elapsed: {
      label: "Time Elapsed",
      color: "#D4F6D3",
    },
    remaining: {
      label: "Time Remaining",
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

  if (!lock) {
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
                  <h2 className="text-2xl font-light text-white mb-3">Lock Not Found</h2>
                  <p className="text-gray-400 mb-6">The lock you're looking for doesn't exist or has been removed.</p>
                  <button
                    onClick={() => router.push('/locks')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5" />
                    Back to Locks
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
                    onClick={() => router.push('/locks')}
                    className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h1 className="text-3xl font-light text-white">Lock Analytics</h1>
                    <p className="text-gray-400 text-sm">Detailed view of your token lock</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!lock.withdrawn && isUnlocked(lock.unlockTs) && (
                    <button
                      onClick={handleWithdraw}
                      disabled={withdrawing}
                      className="flex items-center gap-2 px-6 py-3 bg-green-500/20 text-green-400 rounded-xl font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                    >
                      {withdrawing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Unlock className="h-5 w-5" />
                      )}
                      Withdraw Tokens
                    </button>
                  )}
                  <a
                    href={getExplorerUrl(lock.txHash)}
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <MagicCard className="p-6 rounded-2xl" gradientSize={150} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      lock.withdrawn ? "bg-gray-500/20" : isUnlocked(lock.unlockTs) ? "bg-green-500/20" : "bg-[#D4F6D3]/20"
                    }`}>
                      {lock.withdrawn ? (
                        <Check className="h-5 w-5 text-gray-400" />
                      ) : isUnlocked(lock.unlockTs) ? (
                        <Unlock className="h-5 w-5 text-green-400" />
                      ) : (
                        <Lock className="h-5 w-5 text-[#D4F6D3]" />
                      )}
                    </div>
                    <span className="text-gray-400 text-sm">Status</span>
                  </div>
                  <p className={`text-xl font-medium ${
                    lock.withdrawn ? "text-gray-400" : isUnlocked(lock.unlockTs) ? "text-green-400" : "text-[#D4F6D3]"
                  }`}>
                    {lock.withdrawn ? "Withdrawn" : isUnlocked(lock.unlockTs) ? "Unlocked" : "Locked"}
                  </p>
                </MagicCard>

                <MagicCard className="p-6 rounded-2xl" gradientSize={150} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#D4F6D3]/20 flex items-center justify-center">
                      <Coins className="h-5 w-5 text-[#D4F6D3]" />
                    </div>
                    <span className="text-gray-400 text-sm">Amount Locked</span>
                  </div>
                  <p className="text-xl font-medium text-white">{parseFloat(lock.amount).toLocaleString()} tokens</p>
                </MagicCard>

                <MagicCard className="p-6 rounded-2xl" gradientSize={150} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#D4F6D3]/20 flex items-center justify-center">
                      <Timer className="h-5 w-5 text-[#D4F6D3]" />
                    </div>
                    <span className="text-gray-400 text-sm">Time Remaining</span>
                  </div>
                  {analytics && !lock.withdrawn && !isUnlocked(lock.unlockTs) ? (
                    <p className="text-xl font-medium text-white">
                      {analytics.remainingDays}d {analytics.remainingHours}h {analytics.remainingMinutes}m
                    </p>
                  ) : (
                    <p className="text-xl font-medium text-gray-400">
                      {lock.withdrawn ? "Completed" : "Ready"}
                    </p>
                  )}
                </MagicCard>

                <MagicCard className="p-6 rounded-2xl" gradientSize={150} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#D4F6D3]/20 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-[#D4F6D3]" />
                    </div>
                    <span className="text-gray-400 text-sm">Progress</span>
                  </div>
                  <p className="text-xl font-medium text-white">
                    {analytics ? Math.round(analytics.progressPercent) : 0}%
                  </p>
                </MagicCard>
              </div>

              {/* Progress Bar */}
              <MagicCard className="p-6 rounded-2xl mb-8" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                <div className="flex justify-between text-sm text-gray-400 mb-3">
                  <span>Lock Progress</span>
                  <span>{analytics ? Math.round(analytics.progressPercent) : 0}% Complete</span>
                </div>
                <Progress
                  value={analytics?.progressPercent || 0}
                  className="h-4 bg-[#0B1418]"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-3">
                  <span>Created: {new Date(lock.createdAt).toLocaleDateString()}</span>
                  <span>Unlocks: {new Date(lock.unlockTs * 1000).toLocaleDateString()}</span>
                </div>
              </MagicCard>

              {/* Charts Section */}
              <Tabs defaultValue="timeline" className="mb-8">
                <TabsList className="bg-[#0B1418] border border-[#D4F6D3]/20 mb-6">
                  <TabsTrigger value="timeline" className="data-[state=active]:bg-[#D4F6D3]/20 data-[state=active]:text-[#D4F6D3]">
                    <Activity className="h-4 w-4 mr-2" />
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="status" className="data-[state=active]:bg-[#D4F6D3]/20 data-[state=active]:text-[#D4F6D3]">
                    <PieChart className="h-4 w-4 mr-2" />
                    Status
                  </TabsTrigger>
                  <TabsTrigger value="countdown" className="data-[state=active]:bg-[#D4F6D3]/20 data-[state=active]:text-[#D4F6D3]">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Countdown
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="timeline">
                  <MagicCard className="p-6 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                    <h3 className="text-lg font-medium text-white mb-4">Lock Timeline</h3>
                    <p className="text-gray-400 text-sm mb-6">Visualization of your lock period from creation to unlock date</p>
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                      <AreaChart data={analytics?.timelineData || []}>
                        <defs>
                          <linearGradient id="statusGradient" x1="0" y1="0" x2="0" y2="1">
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
                          tickFormatter={(value) => value === 100 ? 'Locked' : 'Unlocked'}
                          domain={[0, 100]}
                          ticks={[0, 100]}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area
                          type="stepAfter"
                          dataKey="status"
                          stroke="#D4F6D3"
                          fill="url(#statusGradient)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </MagicCard>
                </TabsContent>

                <TabsContent value="status">
                  <MagicCard className="p-6 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                    <h3 className="text-lg font-medium text-white mb-4">Lock Status Distribution</h3>
                    <p className="text-gray-400 text-sm mb-6">Current status breakdown of your token lock</p>
                    <div className="h-[300px] w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={analytics?.statusData || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${Math.round(value)}%`}
                            labelLine={{ stroke: '#6b7280' }}
                          >
                            {analytics?.statusData.map((entry, index) => (
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
                  </MagicCard>
                </TabsContent>

                <TabsContent value="countdown">
                  <MagicCard className="p-6 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                    <h3 className="text-lg font-medium text-white mb-4">Countdown Breakdown</h3>
                    <p className="text-gray-400 text-sm mb-6">Time remaining until unlock in days, hours, minutes, and seconds</p>
                    {!lock.withdrawn && !isUnlocked(lock.unlockTs) ? (
                      <div className="grid grid-cols-4 gap-4">
                        {analytics?.countdownBreakdown.map((item, index) => (
                          <div key={index} className="text-center">
                            <div className="relative w-full aspect-square flex items-center justify-center">
                              <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle
                                  cx="50%"
                                  cy="50%"
                                  r="45%"
                                  fill="none"
                                  stroke="#1f2937"
                                  strokeWidth="8"
                                />
                                <circle
                                  cx="50%"
                                  cy="50%"
                                  r="45%"
                                  fill="none"
                                  stroke={item.fill}
                                  strokeWidth="8"
                                  strokeDasharray={`${(item.value / item.max) * 283} 283`}
                                  strokeLinecap="round"
                                />
                              </svg>
                              <span className="text-2xl font-bold text-white">{item.value}</span>
                            </div>
                            <p className="text-gray-400 text-sm mt-2">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Check className="h-16 w-16 text-green-400 mx-auto mb-4" />
                        <p className="text-xl text-white">
                          {lock.withdrawn ? "Lock Complete - Tokens Withdrawn" : "Lock Complete - Ready to Withdraw"}
                        </p>
                      </div>
                    )}
                  </MagicCard>
                </TabsContent>
              </Tabs>

              {/* Lock Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MagicCard className="p-6 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-[#D4F6D3]" />
                    Timeline Details
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between py-3 border-b border-[#D4F6D3]/10">
                      <span className="text-gray-400">Created</span>
                      <span className="text-white">{new Date(lock.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-[#D4F6D3]/10">
                      <span className="text-gray-400">Unlock Date</span>
                      <span className="text-white">{new Date(lock.unlockTs * 1000).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-[#D4F6D3]/10">
                      <span className="text-gray-400">Total Lock Duration</span>
                      <span className="text-white">
                        {analytics ? Math.ceil(analytics.totalDuration / 86400) : 0} days
                      </span>
                    </div>
                    <div className="flex justify-between py-3">
                      <span className="text-gray-400">Time Elapsed</span>
                      <span className="text-white">
                        {analytics ? Math.floor(analytics.elapsed / 86400) : 0} days
                      </span>
                    </div>
                  </div>
                </MagicCard>

                <MagicCard className="p-6 rounded-2xl" gradientSize={200} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-[#D4F6D3]" />
                    Token Details
                  </h3>
                  <div className="space-y-4">
                    <div className="py-3 border-b border-[#D4F6D3]/10">
                      <span className="text-gray-400 text-sm block mb-1">Token Address</span>
                      <div className="flex items-center gap-2">
                        <code className="text-white text-sm font-mono truncate flex-1">{lock.token}</code>
                        <button
                          onClick={() => copyToClipboard(lock.token)}
                          className="p-1.5 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                        >
                          {copiedAddress === lock.token ? (
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
                        <code className="text-white text-sm font-mono truncate flex-1">{lock.txHash}</code>
                        <button
                          onClick={() => copyToClipboard(lock.txHash)}
                          className="p-1.5 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                        >
                          {copiedAddress === lock.txHash ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="py-3">
                      <span className="text-gray-400 text-sm block mb-1">Lock ID</span>
                      <code className="text-white text-sm font-mono break-all">{lock.id}</code>
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

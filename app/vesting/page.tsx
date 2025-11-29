"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";
import { MagicCard } from "@/components/ui/magic-card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import {
  Droplets,
  ArrowLeft,
  Plus,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Calendar as CalendarIcon,
  User,
  X,
  TrendingUp,
  Activity,
  ChevronDown,
  Coins,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  buildCreateStreamWithDepositPayload,
  buildClaimPayload,
  getWalletFungibleAssets,
  formatTokenBalance,
  parseTokenAmount,
  type CreateStreamParams,
  type WalletToken,
  aptos,
} from "@/lib/lilipadClient";
import { NETWORK } from "@/constants";

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

export default function Vesting() {
  const router = useRouter();
  const { account, signAndSubmitTransaction, connected } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; message: string } | null>(null);
  const [streams, setStreams] = useState<StoredStream[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [selectedToken, setSelectedToken] = useState<WalletToken | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    beneficiary: "",
    token: "",
    totalAmount: "",
    startTime: "",
    endTime: "",
  });

  // Chart configuration
  const chartConfig = {
    vested: {
      label: "Tokens Vested",
      color: "#D4F6D3",
    },
  } satisfies ChartConfig;

  // Generate chart data based on form inputs
  const chartData = useMemo(() => {
    if (!startDate || !endDate || !formData.totalAmount) {
      return [];
    }

    const total = parseFloat(formData.totalAmount) || 0;
    if (total <= 0) return [];

    const [startHours, startMinutes] = (formData.startTime || "00:00").split(":").map(Number);
    const [endHours, endMinutes] = (formData.endTime || "00:00").split(":").map(Number);

    const startDateTime = new Date(startDate);
    startDateTime.setHours(startHours, startMinutes, 0, 0);
    const endDateTime = new Date(endDate);
    endDateTime.setHours(endHours, endMinutes, 0, 0);

    if (endDateTime <= startDateTime) return [];

    const duration = endDateTime.getTime() - startDateTime.getTime();
    const dataPoints: { date: string; vested: number; fullDate: string }[] = [];

    // Generate data points (max 12 for readability)
    const numPoints = Math.min(12, Math.ceil(duration / (24 * 60 * 60 * 1000)) + 1);
    const interval = duration / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const pointTime = new Date(startDateTime.getTime() + interval * i);
      const elapsed = pointTime.getTime() - startDateTime.getTime();
      const vestedAmount = (total * elapsed) / duration;

      dataPoints.push({
        date: format(pointTime, "MMM d"),
        vested: Math.round(vestedAmount * 100) / 100,
        fullDate: format(pointTime, "PPP p"),
      });
    }

    return dataPoints;
  }, [startDate, endDate, formData.totalAmount, formData.startTime, formData.endTime]);

  // Calculate current vesting position for reference line
  const currentVestingInfo = useMemo(() => {
    if (!startDate || !endDate || !formData.totalAmount) return null;

    const total = parseFloat(formData.totalAmount) || 0;
    if (total <= 0) return null;

    const [startHours, startMinutes] = (formData.startTime || "00:00").split(":").map(Number);
    const [endHours, endMinutes] = (formData.endTime || "00:00").split(":").map(Number);

    const startDateTime = new Date(startDate);
    startDateTime.setHours(startHours, startMinutes, 0, 0);
    const endDateTime = new Date(endDate);
    endDateTime.setHours(endHours, endMinutes, 0, 0);

    const now = new Date();
    const duration = endDateTime.getTime() - startDateTime.getTime();

    if (now < startDateTime) {
      return { position: 0, label: "Not Started", vested: 0 };
    }
    if (now >= endDateTime) {
      return { position: 100, label: "Fully Vested", vested: total };
    }

    const elapsed = now.getTime() - startDateTime.getTime();
    const progress = (elapsed / duration) * 100;
    const vestedNow = (total * elapsed) / duration;

    return {
      position: progress,
      label: format(now, "MMM d"),
      vested: Math.round(vestedNow * 100) / 100,
    };
  }, [startDate, endDate, formData.totalAmount, formData.startTime, formData.endTime]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTokenDropdown(false);
      }
    };

    if (showTokenDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTokenDropdown]);

  // Fetch wallet tokens when form is shown
  useEffect(() => {
    const fetchTokens = async () => {
      if (showForm && connected && account?.address) {
        setLoadingTokens(true);
        try {
          const tokens = await getWalletFungibleAssets(account.address.toString());
          setWalletTokens(tokens);
        } catch (error) {
          console.error("Failed to fetch wallet tokens:", error);
        } finally {
          setLoadingTokens(false);
        }
      }
    };

    fetchTokens();
  }, [showForm, connected, account?.address]);

  // Load streams from localStorage on mount
  useEffect(() => {
    const loadStreams = () => {
      try {
        const stored = localStorage.getItem("lilipad_created_streams");
        if (stored) {
          const allStreams: StoredStream[] = JSON.parse(stored);
          if (account?.address) {
            const walletAddress = account.address.toString();
            const userStreams = allStreams.filter(s =>
              localStorage.getItem(`lilipad_stream_owner_${s.id}`) === walletAddress ||
              s.beneficiary.toLowerCase() === walletAddress.toLowerCase()
            );
            setStreams(userStreams);
          } else {
            setStreams([]);
          }
        }
      } catch (error) {
        console.error("Failed to load streams:", error);
      } finally {
        setLoadingStreams(false);
      }
    };

    loadStreams();
  }, [account?.address]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectToken = (token: WalletToken) => {
    setSelectedToken(token);
    setFormData(prev => ({ ...prev, token: token.metadata, totalAmount: "" }));
    setShowTokenDropdown(false);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleSelectStreamType = (type: "linear" | "price") => {
    if (type === "linear") {
      setShowModal(false);
      setShowForm(true);
    }
    // Price-based is coming soon, do nothing
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected || !account) {
      setTxResult({ success: false, message: "Please connect your wallet first" });
      return;
    }

    if (!formData.beneficiary || !formData.token || !formData.totalAmount || !startDate || !endDate || !selectedToken) {
      setTxResult({ success: false, message: "Please fill in all required fields" });
      return;
    }

    // Parse human-readable amount to raw amount
    let rawAmount: bigint;
    try {
      rawAmount = parseTokenAmount(formData.totalAmount, selectedToken.decimals);
    } catch {
      setTxResult({ success: false, message: "Invalid amount format" });
      return;
    }

    if (rawAmount <= BigInt(0)) {
      setTxResult({ success: false, message: "Amount must be greater than 0" });
      return;
    }

    if (rawAmount > selectedToken.balance) {
      setTxResult({ success: false, message: "Insufficient balance" });
      return;
    }

    // Calculate timestamps with time
    const [startHours, startMinutes] = (formData.startTime || "00:00").split(":").map(Number);
    const [endHours, endMinutes] = (formData.endTime || "00:00").split(":").map(Number);
    const startDateTime = new Date(startDate);
    startDateTime.setHours(startHours, startMinutes, 0, 0);
    const endDateTime = new Date(endDate);
    endDateTime.setHours(endHours, endMinutes, 0, 0);
    const startTs = Math.floor(startDateTime.getTime() / 1000);
    const endTs = Math.floor(endDateTime.getTime() / 1000);

    if (startTs >= endTs) {
      setTxResult({ success: false, message: "End time must be after start time" });
      return;
    }

    setIsSubmitting(true);
    setTxResult(null);

    try {
      const params: CreateStreamParams = {
        beneficiary: formData.beneficiary,
        token: formData.token,
        totalAmount: rawAmount,
        startTs: startTs,
        endTs: endTs,
      };

      const payload = buildCreateStreamWithDepositPayload(params);

      const response = await signAndSubmitTransaction({
        data: payload,
      });

      await aptos.waitForTransaction({
        transactionHash: response.hash,
      });

      const walletAddress = account.address.toString();
      const streamId = `${walletAddress}::${Date.now()}`;

      const newStream: StoredStream = {
        id: streamId,
        beneficiary: formData.beneficiary,
        token: formData.token,
        totalAmount: formData.totalAmount,
        startTs: startTs,
        endTs: endTs,
        claimed: "0",
        createdAt: Date.now(),
        txHash: response.hash,
        isOwner: true,
      };

      const stored = localStorage.getItem("lilipad_created_streams");
      const allStreams: StoredStream[] = stored ? JSON.parse(stored) : [];
      allStreams.unshift(newStream);
      localStorage.setItem("lilipad_created_streams", JSON.stringify(allStreams));
      localStorage.setItem(`lilipad_stream_owner_${newStream.id}`, walletAddress);

      setStreams(prev => [newStream, ...prev]);

      setTxResult({
        success: true,
        message: `Vesting stream created successfully!`,
      });

      setFormData({
        beneficiary: "",
        token: "",
        totalAmount: "",
        startTime: "",
        endTime: "",
      });
      setSelectedToken(null);
      setStartDate(undefined);
      setEndDate(undefined);

      setTimeout(() => {
        setShowForm(false);
      }, 2000);

    } catch (error: unknown) {
      console.error("Stream creation failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Transaction failed";
      setTxResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaim = async (stream: StoredStream) => {
    if (!connected || !account) return;

    const walletAddress = account.address.toString();
    if (stream.beneficiary.toLowerCase() !== walletAddress.toLowerCase()) {
      setTxResult({ success: false, message: "Only the beneficiary can claim" });
      return;
    }

    setClaimingId(stream.id);

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
      setClaimingId(null);
    }
  };

  const getExplorerUrl = (txHash: string) => {
    return `https://explorer.aptoslabs.com/txn/${txHash}?network=${NETWORK}`;
  };

  const calculateProgress = (stream: StoredStream) => {
    const now = Math.floor(Date.now() / 1000);
    if (now <= stream.startTs) return 0;
    if (now >= stream.endTs) return 100;
    return Math.round(((now - stream.startTs) / (stream.endTs - stream.startTs)) * 100);
  };

  const calculateUnlocked = (stream: StoredStream) => {
    const now = Math.floor(Date.now() / 1000);
    const total = parseFloat(stream.totalAmount) || 0;
    if (now <= stream.startTs) return 0;
    if (now >= stream.endTs) return total;
    const elapsed = now - stream.startTs;
    const duration = stream.endTs - stream.startTs;
    return (total * elapsed) / duration;
  };

  const formatTimeRemaining = (endTs: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = endTs - now;

    if (diff <= 0) return "Fully vested";

    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);

    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const shortenAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden bg-[url('/image/bg.png')] bg-cover ${poppins.className}`}
    >
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar>
          <main className="flex-1 overflow-auto p-4">
            <SidebarTrigger className="mb-4" />

            <section className="px-4 max-w-4xl mx-auto pb-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  {showForm && (
                    <button
                      onClick={() => {
                        setShowForm(false);
                        setTxResult(null);
                        setSelectedToken(null);
                        setShowTokenDropdown(false);
                        setFormData({ beneficiary: "", token: "", totalAmount: "", startTime: "", endTime: "" });
                        setStartDate(undefined);
                        setEndDate(undefined);
                      }}
                      className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  )}
                  <h1 className="text-4xl font-light text-white">
                    {showForm ? "Create Linear Stream" : "Vesting"}
                  </h1>
                </div>

                {!showForm && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    Create Stream
                  </button>
                )}
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

              {showForm ? (
                /* Stream Creation Form */
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Beneficiary */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      <User className="inline h-4 w-4 mr-2" />
                      Beneficiary Address *
                    </label>
                    <input
                      type="text"
                      name="beneficiary"
                      value={formData.beneficiary}
                      onChange={handleInputChange}
                      placeholder="0x..."
                      required
                      className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      The wallet address that will receive the vested tokens
                    </p>
                  </MagicCard>

                  {/* Token Selection Dropdown */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Select Token *
                    </label>
                    <div className="relative" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => setShowTokenDropdown(!showTokenDropdown)}
                        className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white focus:outline-none focus:border-[#D4F6D3]/50 transition-all flex items-center justify-between"
                      >
                        {loadingTokens ? (
                          <span className="flex items-center gap-2 text-gray-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading tokens...
                          </span>
                        ) : selectedToken ? (
                          <span className="flex items-center gap-3">
                            {selectedToken.iconUri ? (
                              <img
                                src={selectedToken.iconUri}
                                alt={selectedToken.symbol}
                                className="w-8 h-8 rounded-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`w-8 h-8 rounded-full bg-[#D4F6D3]/20 flex items-center justify-center ${selectedToken.iconUri ? 'hidden' : ''}`}>
                              <Coins className="h-4 w-4 text-[#D4F6D3]" />
                            </div>
                            <div className="text-left">
                              <p className="font-medium">{selectedToken.name}</p>
                              <p className="text-xs text-gray-400">
                                Balance: {formatTokenBalance(selectedToken.balance, selectedToken.decimals)} {selectedToken.symbol}
                              </p>
                            </div>
                          </span>
                        ) : (
                          <span className="text-gray-500">Select a token from your wallet</span>
                        )}
                        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${showTokenDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Dropdown Menu */}
                      {showTokenDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                          {loadingTokens ? (
                            <div className="p-4 text-center text-gray-400">
                              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                              Loading tokens...
                            </div>
                          ) : walletTokens.length === 0 ? (
                            <div className="p-4 text-center text-gray-400">
                              <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No tokens found in wallet</p>
                            </div>
                          ) : (
                            walletTokens.map((token, index) => (
                              <button
                                key={token.metadata}
                                type="button"
                                onClick={() => handleSelectToken(token)}
                                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-[#D4F6D3]/10 transition-colors text-left ${
                                  index !== walletTokens.length - 1 ? 'border-b border-[#D4F6D3]/10' : ''
                                } ${selectedToken?.metadata === token.metadata ? 'bg-[#D4F6D3]/5' : ''}`}
                              >
                                {token.iconUri ? (
                                  <img
                                    src={token.iconUri}
                                    alt={token.symbol}
                                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <div className={`w-10 h-10 rounded-full bg-[#D4F6D3]/20 flex items-center justify-center flex-shrink-0 ${token.iconUri ? 'hidden' : ''}`}>
                                  <Coins className="h-5 w-5 text-[#D4F6D3]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-white truncate">{token.name}</p>
                                  <p className="text-xs text-gray-400">{token.symbol}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-white font-medium">
                                    {formatTokenBalance(token.balance, token.decimals)}
                                  </p>
                                  <p className="text-xs text-gray-500">{token.symbol}</p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    {selectedToken && (
                      <p className="text-xs text-gray-500 mt-2 font-mono truncate">
                        {selectedToken.metadata}
                      </p>
                    )}
                  </MagicCard>

                  {/* Total Amount */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-400">
                        Total Amount *
                      </label>
                      {selectedToken && (
                        <span className="text-xs text-gray-500">
                          Available: {formatTokenBalance(selectedToken.balance, selectedToken.decimals)} {selectedToken.symbol}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        name="totalAmount"
                        value={formData.totalAmount}
                        onChange={handleInputChange}
                        placeholder={selectedToken ? `e.g., 0.1 ${selectedToken.symbol}` : "Select a token first"}
                        required
                        disabled={!selectedToken}
                        pattern="[0-9]*\.?[0-9]*"
                        className="w-full px-4 py-3 pr-20 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      {selectedToken && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, totalAmount: formatTokenBalance(selectedToken.balance, selectedToken.decimals) }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#D4F6D3]/20 text-[#D4F6D3] rounded-lg text-xs font-medium hover:bg-[#D4F6D3]/30 transition-colors"
                        >
                          MAX
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Enter the total amount to vest (e.g., 100 {selectedToken?.symbol || 'tokens'})
                    </p>
                  </MagicCard>

                  {/* Start Date & Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MagicCard
                      className="p-6 rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        <CalendarIcon className="inline h-4 w-4 mr-2" />
                        Start Date *
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-left focus:outline-none focus:border-[#D4F6D3]/50 transition-all flex items-center justify-between"
                          >
                            {startDate ? (
                              <span className="text-white">{format(startDate, "PPP")}</span>
                            ) : (
                              <span className="text-gray-500">Select start date</span>
                            )}
                            <CalendarIcon className="h-4 w-4 text-gray-400" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-[#0B1418] border-[#D4F6D3]/20" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            autoFocus
                            className="rounded-xl"
                          />
                        </PopoverContent>
                      </Popover>
                    </MagicCard>

                    <MagicCard
                      className="p-6 rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        <Clock className="inline h-4 w-4 mr-2" />
                        Start Time
                      </label>
                      <input
                        type="time"
                        name="startTime"
                        value={formData.startTime}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                      />
                    </MagicCard>
                  </div>

                  {/* End Date & Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MagicCard
                      className="p-6 rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        <CalendarIcon className="inline h-4 w-4 mr-2" />
                        End Date *
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-left focus:outline-none focus:border-[#D4F6D3]/50 transition-all flex items-center justify-between"
                          >
                            {endDate ? (
                              <span className="text-white">{format(endDate, "PPP")}</span>
                            ) : (
                              <span className="text-gray-500">Select end date</span>
                            )}
                            <CalendarIcon className="h-4 w-4 text-gray-400" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-[#0B1418] border-[#D4F6D3]/20" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            disabled={(date) => startDate ? date <= startDate : date < new Date(new Date().setHours(0, 0, 0, 0))}
                            autoFocus
                            className="rounded-xl"
                          />
                        </PopoverContent>
                      </Popover>
                    </MagicCard>

                    <MagicCard
                      className="p-6 rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        <Clock className="inline h-4 w-4 mr-2" />
                        End Time
                      </label>
                      <input
                        type="time"
                        name="endTime"
                        value={formData.endTime}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                      />
                    </MagicCard>
                  </div>

                  {/* Vesting Schedule Chart */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                          <BarChart3 className="h-5 w-5 text-[#D4F6D3]" />
                          Vesting Schedule Preview
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Visual representation of your linear vesting stream
                        </p>
                      </div>
                      {chartData.length > 0 && currentVestingInfo && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Today&apos;s Position</p>
                          <p className="text-sm font-medium text-[#D4F6D3]">
                            {currentVestingInfo.vested.toLocaleString()} {selectedToken?.symbol || 'tokens'}
                          </p>
                        </div>
                      )}
                    </div>

                    {chartData.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[280px] w-full">
                        <AreaChart
                          data={chartData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                        >
                          <defs>
                            <linearGradient id="vestingGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#D4F6D3" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="#D4F6D3" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#D4F6D3"
                            strokeOpacity={0.1}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                            dx={-10}
                            tickFormatter={(value) => value.toLocaleString()}
                          />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                className="bg-[#0B1418] border-[#D4F6D3]/20"
                                labelClassName="text-white"
                                formatter={(value, name) => (
                                  <div className="flex items-center gap-2">
                                    <div className="h-2.5 w-2.5 rounded-full bg-[#D4F6D3]" />
                                    <span className="text-gray-400">Vested:</span>
                                    <span className="text-white font-medium">
                                      {Number(value).toLocaleString()} {selectedToken?.symbol || 'tokens'}
                                    </span>
                                  </div>
                                )}
                              />
                            }
                          />
                          <Area
                            type="linear"
                            dataKey="vested"
                            stroke="#D4F6D3"
                            strokeWidth={2}
                            fill="url(#vestingGradient)"
                            dot={false}
                            activeDot={{
                              r: 6,
                              fill: "#D4F6D3",
                              stroke: "#0B1418",
                              strokeWidth: 2,
                            }}
                          />
                          {currentVestingInfo && currentVestingInfo.position > 0 && currentVestingInfo.position < 100 && (
                            <ReferenceLine
                              x={currentVestingInfo.label}
                              stroke="#D4F6D3"
                              strokeDasharray="5 5"
                              strokeOpacity={0.6}
                              label={{
                                value: "Today",
                                position: "top",
                                fill: "#D4F6D3",
                                fontSize: 11,
                              }}
                            />
                          )}
                        </AreaChart>
                      </ChartContainer>
                    ) : (
                      <div className="h-[280px] flex items-center justify-center border border-dashed border-[#D4F6D3]/20 rounded-xl">
                        <div className="text-center">
                          <BarChart3 className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-500 text-sm">
                            Enter amount and select dates to preview vesting schedule
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Chart Legend */}
                    {chartData.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#D4F6D3]/10 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Start Date</p>
                          <p className="text-white font-medium text-sm">
                            {startDate ? format(startDate, "MMM d, yyyy") : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">End Date</p>
                          <p className="text-white font-medium text-sm">
                            {endDate ? format(endDate, "MMM d, yyyy") : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total Amount</p>
                          <p className="text-white font-medium text-sm">
                            {parseFloat(formData.totalAmount || "0").toLocaleString()} {selectedToken?.symbol || 'tokens'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Vesting Type</p>
                          <p className="text-[#D4F6D3] font-medium text-sm flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            Linear
                          </p>
                        </div>
                      </div>
                    )}
                  </MagicCard>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-6 pb-8">
                    <button
                      type="submit"
                      disabled={isSubmitting || !connected}
                      className="flex items-center gap-2 px-10 py-4 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-semibold hover:bg-[#c2e8c1] transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#D4F6D3]/20"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-6 w-6 animate-spin" />
                          Creating Stream...
                        </>
                      ) : (
                        <>
                          <Droplets className="h-6 w-6" />
                          {connected ? "Create Vesting Stream" : "Connect Wallet"}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Streams List */
                <div className="space-y-6">
                  {loadingStreams ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-[#D4F6D3]" />
                    </div>
                  ) : !connected ? (
                    <MagicCard
                      className="p-12 rounded-2xl text-center"
                      gradientSize={300}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <Droplets className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                      <h2 className="text-2xl font-light text-white mb-3">
                        Connect Your Wallet
                      </h2>
                      <p className="text-gray-400">
                        Connect your wallet to view and create vesting streams
                      </p>
                    </MagicCard>
                  ) : streams.length === 0 ? (
                    <MagicCard
                      className="p-12 rounded-2xl text-center"
                      gradientSize={300}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <Droplets className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                      <h2 className="text-2xl font-light text-white mb-3">
                        No Vesting Streams
                      </h2>
                      <p className="text-gray-400 mb-6">
                        Create a vesting stream for token distribution
                      </p>
                      <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                      >
                        <Plus className="h-5 w-5" />
                        Create Your First Stream
                      </button>
                    </MagicCard>
                  ) : (
                    <div className="grid gap-4">
                      {streams.map((stream) => {
                        const progress = calculateProgress(stream);
                        const unlocked = calculateUnlocked(stream);
                        const claimed = parseFloat(stream.claimed) || 0;
                        const claimable = unlocked - claimed;
                        const isBeneficiary = account?.address &&
                          stream.beneficiary.toLowerCase() === account.address.toString().toLowerCase();

                        return (
                          <MagicCard
                            key={stream.id}
                            className="p-6 rounded-2xl cursor-pointer hover:border-[#D4F6D3]/50 transition-all group"
                            gradientSize={200}
                            gradientFrom="#d4f6d3"
                            gradientTo="#0b1418"
                          >
                            <div
                              className="flex items-start justify-between"
                              onClick={() => router.push(`/vesting/${encodeURIComponent(stream.id)}`)}
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-[#D4F6D3]/20 flex items-center justify-center">
                                  <Droplets className="h-6 w-6 text-[#D4F6D3]" />
                                </div>
                                <div>
                                  <h3 className="text-xl font-medium text-white">
                                    {parseFloat(stream.totalAmount).toLocaleString()} tokens
                                  </h3>
                                  <p className="text-sm text-[#D4F6D3]">
                                    {formatTimeRemaining(stream.endTs)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isBeneficiary && claimable > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleClaim(stream);
                                    }}
                                    disabled={claimingId === stream.id}
                                    className="px-4 py-2 bg-[#D4F6D3]/20 text-[#D4F6D3] rounded-lg font-medium hover:bg-[#D4F6D3]/30 transition-colors disabled:opacity-50"
                                  >
                                    {claimingId === stream.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "Claim"
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/vesting/${encodeURIComponent(stream.id)}`);
                                  }}
                                  className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                                  title="View Analytics"
                                >
                                  <BarChart3 className="h-4 w-4" />
                                </button>
                                <a
                                  href={getExplorerUrl(stream.txHash)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                                <ChevronRight className="h-5 w-5 text-gray-500 group-hover:text-[#D4F6D3] transition-colors" />
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div
                              className="mt-4"
                              onClick={() => router.push(`/vesting/${encodeURIComponent(stream.id)}`)}
                            >
                              <div className="flex justify-between text-xs text-gray-500 mb-2">
                                <span>Progress</span>
                                <span>{progress}% vested</span>
                              </div>
                              <div className="h-2 bg-[#0B1418] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#D4F6D3] to-[#a8e6a3] rounded-full transition-all duration-500"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>

                            <div
                              className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4"
                              onClick={() => router.push(`/vesting/${encodeURIComponent(stream.id)}`)}
                            >
                              <div>
                                <p className="text-xs text-gray-500">Unlocked</p>
                                <p className="text-white font-medium">
                                  {unlocked.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Claimed</p>
                                <p className="text-white font-medium">
                                  {claimed.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Start</p>
                                <p className="text-white font-medium">
                                  {new Date(stream.startTs * 1000).toLocaleDateString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">End</p>
                                <p className="text-white font-medium">
                                  {new Date(stream.endTs * 1000).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-[#D4F6D3]/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Beneficiary</p>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs text-gray-400 font-mono">
                                    {shortenAddress(stream.beneficiary)}
                                  </code>
                                  {isBeneficiary && (
                                    <span className="text-xs bg-[#D4F6D3]/20 text-[#D4F6D3] px-2 py-0.5 rounded">
                                      You
                                    </span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(stream.beneficiary);
                                    }}
                                    className="p-1 rounded bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white transition-all"
                                  >
                                    {copiedAddress === stream.beneficiary ? (
                                      <Check className="h-3 w-3 text-green-400" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Token</p>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs text-gray-400 font-mono truncate">
                                    {shortenAddress(stream.token)}
                                  </code>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(stream.token);
                                    }}
                                    className="p-1 rounded bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white transition-all"
                                  >
                                    {copiedAddress === stream.token ? (
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
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          </main>
        </AppSidebar>
      </div>

      {/* Stream Type Selection Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-[#0B1418] border border-[#D4F6D3]/20 rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#D4F6D3]/10 transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-2xl font-light text-white mb-2">Select Stream Type</h2>
            <p className="text-gray-400 mb-8">Choose how you want to distribute tokens</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Linear Stream */}
              <button
                onClick={() => handleSelectStreamType("linear")}
                className="group text-left"
              >
                <MagicCard
                  className="p-6 rounded-2xl h-full transition-all group-hover:border-[#D4F6D3]/50"
                  gradientSize={200}
                  gradientFrom="#d4f6d3"
                  gradientTo="#0b1418"
                >
                  <h3 className="text-xl font-medium text-white mb-3 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[#D4F6D3]" />
                    Linear
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Contract that gradually releases tokens to recipients after a certain period of time.
                  </p>
                </MagicCard>
              </button>

              {/* Price-Based Stream */}
              <div className="relative">
                <MagicCard
                  className="p-6 rounded-2xl h-full opacity-60 cursor-not-allowed"
                  gradientSize={200}
                  gradientFrom="#d4f6d3"
                  gradientTo="#0b1418"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-medium text-white flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-[#D4F6D3]" />
                      Price-based
                    </h3>
                    <span className="text-xs bg-[#D4F6D3]/20 text-[#D4F6D3] px-2 py-1 rounded-full">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Dynamically adjusts token unlocks based on market performance metrics.
                  </p>
                </MagicCard>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

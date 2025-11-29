"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";
import { MagicCard } from "@/components/ui/magic-card";
import {
  Lock,
  ArrowLeft,
  Plus,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Unlock,
  Calendar as CalendarIcon,
  X,
  Timer,
  TrendingUp,
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
  buildCreateLockWithDepositPayload,
  buildWithdrawLockedPayload,
  getWalletFungibleAssets,
  formatTokenBalance,
  parseTokenAmount,
  type CreateLockParams,
  type WalletToken,
  aptos,
} from "@/lib/lilipadClient";
import { NETWORK } from "@/constants";

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

export default function Locks() {
  const router = useRouter();
  const { account, signAndSubmitTransaction, connected } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; message: string } | null>(null);
  const [locks, setLocks] = useState<StoredLock[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [loadingLocks, setLoadingLocks] = useState(true);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [selectedToken, setSelectedToken] = useState<WalletToken | null>(null);
  const [unlockDate, setUnlockDate] = useState<Date | undefined>(undefined);

  const [formData, setFormData] = useState({
    token: "",
    amount: "",
    unlockTime: "",
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Load locks from localStorage on mount
  useEffect(() => {
    const loadLocks = () => {
      try {
        const stored = localStorage.getItem("lilipad_created_locks");
        if (stored) {
          const allLocks: StoredLock[] = JSON.parse(stored);
          if (account?.address) {
            const walletAddress = account.address.toString();
            const userLocks = allLocks.filter(l =>
              localStorage.getItem(`lilipad_lock_owner_${l.id}`) === walletAddress
            );
            setLocks(userLocks);
          } else {
            setLocks([]);
          }
        }
      } catch (error) {
        console.error("Failed to load locks:", error);
      } finally {
        setLoadingLocks(false);
      }
    };

    loadLocks();
  }, [account?.address]);

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

  const handleSelectToken = (token: WalletToken) => {
    setSelectedToken(token);
    setFormData(prev => ({ ...prev, token: token.metadata, amount: "" }));
    setShowTokenDropdown(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleSelectLockType = (type: "time" | "price") => {
    if (type === "time") {
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

    if (!formData.token || !formData.amount || !unlockDate || !selectedToken) {
      setTxResult({ success: false, message: "Please fill in all required fields" });
      return;
    }

    // Parse human-readable amount to raw amount
    let rawAmount: bigint;
    try {
      rawAmount = parseTokenAmount(formData.amount, selectedToken.decimals);
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

    // Calculate unlock timestamp
    const [hours, minutes] = (formData.unlockTime || "00:00").split(":").map(Number);
    const unlockDateTime = new Date(unlockDate);
    unlockDateTime.setHours(hours, minutes, 0, 0);
    const unlockTs = Math.floor(unlockDateTime.getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);

    if (unlockTs <= now) {
      setTxResult({ success: false, message: "Unlock time must be in the future" });
      return;
    }

    setIsSubmitting(true);
    setTxResult(null);

    try {
      const params: CreateLockParams = {
        token: formData.token,
        amount: rawAmount,
        unlockTs: unlockTs,
      };

      const payload = buildCreateLockWithDepositPayload(params);

      const response = await signAndSubmitTransaction({
        data: payload,
      });

      await aptos.waitForTransaction({
        transactionHash: response.hash,
      });

      const walletAddress = account.address.toString();
      const lockId = `${walletAddress}::${Date.now()}`;

      const newLock: StoredLock = {
        id: lockId,
        token: formData.token,
        amount: formData.amount,
        unlockTs: unlockTs,
        createdAt: Date.now(),
        txHash: response.hash,
        withdrawn: false,
      };

      const stored = localStorage.getItem("lilipad_created_locks");
      const allLocks: StoredLock[] = stored ? JSON.parse(stored) : [];
      allLocks.unshift(newLock);
      localStorage.setItem("lilipad_created_locks", JSON.stringify(allLocks));
      localStorage.setItem(`lilipad_lock_owner_${newLock.id}`, walletAddress);

      setLocks(prev => [newLock, ...prev]);

      setTxResult({
        success: true,
        message: `Tokens locked successfully until ${unlockDateTime.toLocaleString()}!`,
      });

      setFormData({
        token: "",
        amount: "",
        unlockTime: "",
      });
      setSelectedToken(null);
      setUnlockDate(undefined);

      setTimeout(() => {
        setShowForm(false);
      }, 2000);

    } catch (error: unknown) {
      console.error("Lock creation failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Transaction failed";
      setTxResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async (lock: StoredLock) => {
    if (!connected || !account) return;

    const now = Math.floor(Date.now() / 1000);
    if (now < lock.unlockTs) {
      setTxResult({ success: false, message: "Lock has not expired yet" });
      return;
    }

    setWithdrawingId(lock.id);

    try {
      const payload = buildWithdrawLockedPayload(0);

      const response = await signAndSubmitTransaction({
        data: payload,
      });

      await aptos.waitForTransaction({
        transactionHash: response.hash,
      });

      const updatedLocks = locks.map(l =>
        l.id === lock.id ? { ...l, withdrawn: true } : l
      );
      setLocks(updatedLocks);

      const stored = localStorage.getItem("lilipad_created_locks");
      if (stored) {
        const allLocks: StoredLock[] = JSON.parse(stored);
        const updated = allLocks.map(l =>
          l.id === lock.id ? { ...l, withdrawn: true } : l
        );
        localStorage.setItem("lilipad_created_locks", JSON.stringify(updated));
      }

      setTxResult({ success: true, message: "Tokens withdrawn successfully!" });
    } catch (error: unknown) {
      console.error("Withdraw failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Withdraw failed";
      setTxResult({ success: false, message: errorMessage });
    } finally {
      setWithdrawingId(null);
    }
  };

  const getExplorerUrl = (txHash: string) => {
    return `https://explorer.aptoslabs.com/txn/${txHash}?network=${NETWORK}`;
  };

  const formatTimeRemaining = (unlockTs: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = unlockTs - now;

    if (diff <= 0) return "Unlocked";

    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const isUnlocked = (unlockTs: number) => {
    return Math.floor(Date.now() / 1000) >= unlockTs;
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
                        setFormData({ token: "", amount: "", unlockTime: "" });
                        setUnlockDate(undefined);
                      }}
                      className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  )}
                  <h1 className="text-4xl font-light text-white">
                    {showForm ? "Create Time-Based Lock" : "Locks"}
                  </h1>
                </div>

                {!showForm && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    Create Lock
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
                /* Lock Creation Form */
                <form onSubmit={handleSubmit} className="space-y-6">
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

                  {/* Amount */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-400">
                        Amount *
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
                        name="amount"
                        value={formData.amount}
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
                          onClick={() => setFormData(prev => ({ ...prev, amount: formatTokenBalance(selectedToken.balance, selectedToken.decimals) }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#D4F6D3]/20 text-[#D4F6D3] rounded-lg text-xs font-medium hover:bg-[#D4F6D3]/30 transition-colors"
                        >
                          MAX
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Enter the amount you want to lock (e.g., 1.5 {selectedToken?.symbol || 'tokens'})
                    </p>
                  </MagicCard>

                  {/* Unlock Date & Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MagicCard
                      className="p-6 rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        <CalendarIcon className="inline h-4 w-4 mr-2" />
                        Unlock Date *
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-left focus:outline-none focus:border-[#D4F6D3]/50 transition-all flex items-center justify-between"
                          >
                            {unlockDate ? (
                              <span className="text-white">{format(unlockDate, "PPP")}</span>
                            ) : (
                              <span className="text-gray-500">Select unlock date</span>
                            )}
                            <CalendarIcon className="h-4 w-4 text-gray-400" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-[#0B1418] border-[#D4F6D3]/20" align="start">
                          <Calendar
                            mode="single"
                            selected={unlockDate}
                            onSelect={setUnlockDate}
                            disabled={(date) => date < new Date()}
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
                        Unlock Time
                      </label>
                      <input
                        type="time"
                        name="unlockTime"
                        value={formData.unlockTime}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Optional (defaults to 00:00)
                      </p>
                    </MagicCard>
                  </div>

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
                          Creating Lock...
                        </>
                      ) : (
                        <>
                          <Lock className="h-6 w-6" />
                          {connected ? "Lock Tokens" : "Connect Wallet to Lock"}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Locks List */
                <div className="space-y-6">
                  {loadingLocks ? (
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
                      <Lock className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                      <h2 className="text-2xl font-light text-white mb-3">
                        Connect Your Wallet
                      </h2>
                      <p className="text-gray-400">
                        Connect your wallet to view and create token locks
                      </p>
                    </MagicCard>
                  ) : locks.length === 0 ? (
                    <MagicCard
                      className="p-12 rounded-2xl text-center"
                      gradientSize={300}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <Lock className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                      <h2 className="text-2xl font-light text-white mb-3">
                        No Locks Yet
                      </h2>
                      <p className="text-gray-400 mb-6">
                        Lock your tokens for a specified period
                      </p>
                      <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                      >
                        <Plus className="h-5 w-5" />
                        Create Your First Lock
                      </button>
                    </MagicCard>
                  ) : (
                    <div className="grid gap-4">
                      {locks.map((lock) => (
                        <MagicCard
                          key={lock.id}
                          className="p-6 rounded-2xl cursor-pointer hover:border-[#D4F6D3]/50 transition-all group"
                          gradientSize={200}
                          gradientFrom="#d4f6d3"
                          gradientTo="#0b1418"
                        >
                          <div
                            className="flex items-start justify-between"
                            onClick={() => router.push(`/locks/${encodeURIComponent(lock.id)}`)}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                lock.withdrawn
                                  ? "bg-gray-500/20"
                                  : isUnlocked(lock.unlockTs)
                                  ? "bg-green-500/20"
                                  : "bg-[#D4F6D3]/20"
                              }`}>
                                {lock.withdrawn ? (
                                  <Check className="h-6 w-6 text-gray-400" />
                                ) : isUnlocked(lock.unlockTs) ? (
                                  <Unlock className="h-6 w-6 text-green-400" />
                                ) : (
                                  <Lock className="h-6 w-6 text-[#D4F6D3]" />
                                )}
                              </div>
                              <div>
                                <h3 className="text-xl font-medium text-white">
                                  {lock.amount} tokens
                                </h3>
                                <p className={`text-sm ${
                                  lock.withdrawn
                                    ? "text-gray-500"
                                    : isUnlocked(lock.unlockTs)
                                    ? "text-green-400"
                                    : "text-[#D4F6D3]"
                                }`}>
                                  {lock.withdrawn
                                    ? "Withdrawn"
                                    : formatTimeRemaining(lock.unlockTs)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!lock.withdrawn && isUnlocked(lock.unlockTs) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleWithdraw(lock);
                                  }}
                                  disabled={withdrawingId === lock.id}
                                  className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                                >
                                  {withdrawingId === lock.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Withdraw"
                                  )}
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/locks/${encodeURIComponent(lock.id)}`);
                                }}
                                className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                                title="View Analytics"
                              >
                                <BarChart3 className="h-4 w-4" />
                              </button>
                              <a
                                href={getExplorerUrl(lock.txHash)}
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

                          <div
                            className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4"
                            onClick={() => router.push(`/locks/${encodeURIComponent(lock.id)}`)}
                          >
                            <div>
                              <p className="text-xs text-gray-500">Unlock Date</p>
                              <p className="text-white font-medium">
                                {new Date(lock.unlockTs * 1000).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Unlock Time</p>
                              <p className="text-white font-medium">
                                {new Date(lock.unlockTs * 1000).toLocaleTimeString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Created</p>
                              <p className="text-white font-medium">
                                {new Date(lock.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-[#D4F6D3]/10">
                            <p className="text-xs text-gray-500 mb-1">Token Address</p>
                            <div className="flex items-center gap-2">
                              <code className="text-xs text-gray-400 font-mono truncate flex-1">
                                {lock.token}
                              </code>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(lock.token);
                                }}
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
                        </MagicCard>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </main>
        </AppSidebar>
      </div>

      {/* Lock Type Selection Modal */}
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

            <h2 className="text-2xl font-light text-white mb-2">Select Lock Type</h2>
            <p className="text-gray-400 mb-8">Choose how you want to lock your tokens</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Time-Based Lock */}
              <button
                onClick={() => handleSelectLockType("time")}
                className="group text-left"
              >
                <MagicCard
                  className="p-6 rounded-2xl h-full transition-all group-hover:border-[#D4F6D3]/50"
                  gradientSize={200}
                  gradientFrom="#d4f6d3"
                  gradientTo="#0b1418"
                >
                  <h3 className="text-xl font-medium text-white mb-3 flex items-center gap-2">
                    <Timer className="h-5 w-5 text-[#D4F6D3]" />
                    Time-based
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Lock your tokens for a set time. When the time is up, they&apos;re returned to your wallet.
                  </p>
                </MagicCard>
              </button>

              {/* Price-Based Lock */}
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
                    Lock tokens until your market conditions are met, then they&apos;re returned to your wallet.
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

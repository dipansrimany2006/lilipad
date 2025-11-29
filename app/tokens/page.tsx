"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";
import { MagicCard } from "@/components/ui/magic-card";
import {
  Upload,
  Globe,
  ArrowLeft,
  Coins,
  Plus,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  BarChart3,
  TrendingUp,
  Clock,
  Database,
} from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  buildCreateTokenPayload,
  type CreateTokenParams,
  aptos,
} from "@/lib/lilipadClient";
import { NETWORK } from "@/constants";

const poppins = Poppins({ weight: ["200", "300", "400", "700"], subsets: ["latin"] });

interface StoredToken {
  metadataAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  maxSupply: string;
  createdAt: number;
  txHash: string;
}

export default function Tokens() {
  const { account, signAndSubmitTransaction, connected } = useWallet();
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; message: string } | null>(null);
  const [tokens, setTokens] = useState<StoredToken[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [loadingTokens, setLoadingTokens] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    decimals: "8",
    initialSupply: "",
    maxSupply: "",
    iconUri: "",
    projectUri: "",
    image: null as File | null,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Load tokens from localStorage on mount
  useEffect(() => {
    const loadTokens = () => {
      try {
        const stored = localStorage.getItem("lilipad_created_tokens");
        if (stored) {
          let allTokens: StoredToken[];
          try {
            allTokens = JSON.parse(stored);
          } catch {
            // Invalid JSON in localStorage, clear it
            console.error("Invalid JSON in lilipad_created_tokens, clearing storage");
            localStorage.removeItem("lilipad_created_tokens");
            setTokens([]);
            return;
          }
          // Filter tokens by current wallet address if connected
          if (account?.address) {
            const walletAddress = account.address.toString();
            const userTokens = allTokens.filter(t =>
              localStorage.getItem(`lilipad_token_owner_${t.metadataAddress}`) === walletAddress
            );
            setTokens(userTokens);
          } else {
            setTokens([]);
          }
        }
      } catch (error) {
        console.error("Failed to load tokens:", error);
      } finally {
        setLoadingTokens(false);
      }
    };

    loadTokens();
  }, [account?.address]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const copyToClipboard = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Analytics data for token creation
  const analytics = useMemo(() => {
    const totalTokensCreated = tokens.length;
    const totalInitialSupply = tokens.reduce(
      (sum, t) => sum + BigInt(t.initialSupply || "0"),
      BigInt(0)
    );
    const totalMaxSupply = tokens.reduce(
      (sum, t) => sum + BigInt(t.maxSupply || "0"),
      BigInt(0)
    );
    const latestToken = tokens.length > 0 ? tokens[0] : null;

    return {
      totalTokensCreated,
      totalInitialSupply,
      totalMaxSupply,
      latestToken,
    };
  }, [tokens]);

  const formatLargeNumber = (num: bigint) => {
    if (num === BigInt(0)) return "0";
    const numStr = num.toString();
    if (numStr.length > 12) {
      return (Number(num) / 1e12).toFixed(2) + "T";
    } else if (numStr.length > 9) {
      return (Number(num) / 1e9).toFixed(2) + "B";
    } else if (numStr.length > 6) {
      return (Number(num) / 1e6).toFixed(2) + "M";
    } else if (numStr.length > 3) {
      return (Number(num) / 1e3).toFixed(2) + "K";
    }
    return num.toLocaleString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected || !account) {
      setTxResult({ success: false, message: "Please connect your wallet first" });
      return;
    }

    // Validate required fields
    if (!formData.name || !formData.symbol || !formData.initialSupply) {
      setTxResult({ success: false, message: "Please fill in all required fields" });
      return;
    }

    // Validate decimals
    const decimals = parseInt(formData.decimals);
    if (isNaN(decimals) || decimals < 0 || decimals > 18) {
      setTxResult({ success: false, message: "Decimals must be between 0 and 18" });
      return;
    }

    // Validate supplies
    const initialSupply = BigInt(formData.initialSupply || "0");
    const maxSupply = BigInt(formData.maxSupply || "0");

    if (maxSupply > BigInt(0) && initialSupply > maxSupply) {
      setTxResult({ success: false, message: "Initial supply cannot exceed max supply" });
      return;
    }

    setIsSubmitting(true);
    setTxResult(null);

    try {
      const params: CreateTokenParams = {
        name: formData.name,
        symbol: formData.symbol.toUpperCase(),
        decimals: decimals,
        icon_uri: formData.iconUri || "",
        project_uri: formData.projectUri || "",
        initial_supply: initialSupply,
        max_supply: maxSupply,
      };

      const payload = buildCreateTokenPayload(params);

      const response = await signAndSubmitTransaction({
        data: payload,
      });

      // Wait for transaction
      await aptos.waitForTransaction({
        transactionHash: response.hash,
      });

      const walletAddress = account.address.toString();

      // Create stored token record
      const newToken: StoredToken = {
        metadataAddress: `${walletAddress}::${formData.symbol.toUpperCase()}`,
        name: formData.name,
        symbol: formData.symbol.toUpperCase(),
        decimals: decimals,
        initialSupply: formData.initialSupply,
        maxSupply: formData.maxSupply || "0",
        createdAt: Date.now(),
        txHash: response.hash,
      };

      // Store token in localStorage
      const stored = localStorage.getItem("lilipad_created_tokens");
      const allTokens: StoredToken[] = stored ? JSON.parse(stored) : [];
      allTokens.unshift(newToken);
      localStorage.setItem("lilipad_created_tokens", JSON.stringify(allTokens));

      // Store ownership mapping
      localStorage.setItem(`lilipad_token_owner_${newToken.metadataAddress}`, walletAddress);

      // Update local state
      setTokens(prev => [newToken, ...prev]);

      setTxResult({
        success: true,
        message: `Token "${formData.name}" created successfully!`,
      });

      // Reset form
      setFormData({
        name: "",
        symbol: "",
        decimals: "8",
        initialSupply: "",
        maxSupply: "",
        iconUri: "",
        projectUri: "",
        image: null,
      });
      setImagePreview(null);

      // Switch back to tokens list after short delay
      setTimeout(() => {
        setShowForm(false);
      }, 2000);

    } catch (error: unknown) {
      console.error("Token creation failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Transaction failed";
      setTxResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getExplorerUrl = (txHash: string) => {
    const baseUrl = NETWORK === "mainnet"
      ? "https://explorer.aptoslabs.com"
      : "https://explorer.aptoslabs.com";
    return `${baseUrl}/txn/${txHash}?network=${NETWORK}`;
  };

  const formatSupply = (supply: string) => {
    const num = BigInt(supply);
    if (num === BigInt(0)) return "Unlimited";
    return num.toLocaleString();
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
                      }}
                      className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  )}
                  <h1 className="text-4xl font-light text-white">
                    {showForm ? "Create Token" : "Tokens"}
                  </h1>
                </div>

                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    Create Token
                  </button>
                )}
              </div>

              {/* Analytics Overview */}
              {!showForm && connected && tokens.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <MagicCard
                    className="p-4 rounded-xl"
                    gradientSize={150}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#D4F6D3]/10">
                        <BarChart3 className="h-5 w-5 text-[#D4F6D3]" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Tokens Created</p>
                        <p className="text-lg font-medium text-white">{analytics.totalTokensCreated}</p>
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
                        <TrendingUp className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Initial Supply</p>
                        <p className="text-lg font-medium text-white">
                          {formatLargeNumber(analytics.totalInitialSupply)}
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
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <Database className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Max Supply</p>
                        <p className="text-lg font-medium text-white">
                          {analytics.totalMaxSupply > BigInt(0)
                            ? formatLargeNumber(analytics.totalMaxSupply)
                            : "Unlimited"}
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
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <Clock className="h-5 w-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Latest Token</p>
                        <p className="text-lg font-medium text-white truncate max-w-[120px]">
                          {analytics.latestToken?.symbol || "—"}
                        </p>
                      </div>
                    </div>
                  </MagicCard>
                </div>
              )}

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
                /* Token Creation Form */
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Token Name & Symbol Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Token Name */}
                    <MagicCard
                      className="p-6 rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Token Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="My Awesome Token"
                        required
                        className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                      />
                    </MagicCard>

                    {/* Token Symbol */}
                    <MagicCard
                      className="p-6 rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Token Symbol *
                      </label>
                      <input
                        type="text"
                        name="symbol"
                        value={formData.symbol}
                        onChange={handleInputChange}
                        placeholder="MAT"
                        required
                        maxLength={10}
                        className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all uppercase"
                      />
                    </MagicCard>
                  </div>

                  {/* Decimals & Initial Supply Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Decimals */}
                    <MagicCard
                      className="p-6 rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Decimals *
                      </label>
                      <input
                        type="number"
                        name="decimals"
                        value={formData.decimals}
                        onChange={handleInputChange}
                        placeholder="8"
                        required
                        min={0}
                        max={18}
                        className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Usually 6 or 8 for Aptos tokens (max 18)
                      </p>
                    </MagicCard>

                    {/* Initial Supply */}
                    <MagicCard
                      className="p-6 rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Initial Supply *
                      </label>
                      <input
                        type="text"
                        name="initialSupply"
                        value={formData.initialSupply}
                        onChange={handleInputChange}
                        placeholder="1000000"
                        required
                        pattern="[0-9]*"
                        className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Tokens minted to your wallet
                      </p>
                    </MagicCard>
                  </div>

                  {/* Max Supply */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      <Coins className="inline h-4 w-4 mr-2" />
                      Max Supply
                    </label>
                    <input
                      type="text"
                      name="maxSupply"
                      value={formData.maxSupply}
                      onChange={handleInputChange}
                      placeholder="10000000"
                      pattern="[0-9]*"
                      className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Leave empty or 0 for unlimited supply
                    </p>
                  </MagicCard>

                  {/* Token Icon */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Token Icon
                    </label>
                    <div className="flex items-center gap-6">
                      <label className="flex-1 cursor-pointer">
                        <div className="flex flex-col items-center justify-center px-6 py-8 border-2 border-dashed border-[#D4F6D3]/20 rounded-xl hover:border-[#D4F6D3]/50 transition-all">
                          <Upload className="h-10 w-10 text-gray-400 mb-3" />
                          <p className="text-sm text-gray-400">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            PNG, JPG, GIF up to 5MB
                          </p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                      {imagePreview && (
                        <div className="w-32 h-32 rounded-xl overflow-hidden border border-[#D4F6D3]/20">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </MagicCard>

                  {/* URLs Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Icon URI */}
                    <MagicCard
                      className="p-6 rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        <Upload className="inline h-4 w-4 mr-2" />
                        Icon URL
                      </label>
                      <input
                        type="url"
                        name="iconUri"
                        value={formData.iconUri}
                        onChange={handleInputChange}
                        placeholder="https://example.com/icon.png"
                        className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                      />
                    </MagicCard>

                    {/* Project URI */}
                    <MagicCard
                      className="p-6 rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        <Globe className="inline h-4 w-4 mr-2" />
                        Project URL
                      </label>
                      <input
                        type="url"
                        name="projectUri"
                        value={formData.projectUri}
                        onChange={handleInputChange}
                        placeholder="https://myproject.com"
                        className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                      />
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
                          Creating Token...
                        </>
                      ) : (
                        <>
                          <Coins className="h-6 w-6" />
                          {connected ? "Create Token" : "Connect Wallet to Create"}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Tokens List */
                <div className="space-y-6">
                  {loadingTokens ? (
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
                      <Coins className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                      <h2 className="text-2xl font-light text-white mb-3">
                        Connect Your Wallet
                      </h2>
                      <p className="text-gray-400">
                        Connect your wallet to view and create tokens
                      </p>
                    </MagicCard>
                  ) : tokens.length === 0 ? (
                    <MagicCard
                      className="p-12 rounded-2xl text-center"
                      gradientSize={300}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <Coins className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                      <h2 className="text-2xl font-light text-white mb-3">
                        No Tokens Yet
                      </h2>
                      <p className="text-gray-400 mb-6">
                        Create your first Fungible Asset token on Aptos
                      </p>
                      <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                      >
                        <Plus className="h-5 w-5" />
                        Create Your First Token
                      </button>
                    </MagicCard>
                  ) : (
                    <div className="grid gap-4">
                      {tokens.map((token) => (
                        <MagicCard
                          key={token.txHash}
                          className="p-6 rounded-2xl"
                          gradientSize={200}
                          gradientFrom="#d4f6d3"
                          gradientTo="#0b1418"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-[#D4F6D3]/20 flex items-center justify-center">
                                <Coins className="h-6 w-6 text-[#D4F6D3]" />
                              </div>
                              <div>
                                <h3 className="text-xl font-medium text-white">
                                  {token.name}
                                </h3>
                                <p className="text-[#D4F6D3] font-mono">
                                  ${token.symbol}
                                </p>
                              </div>
                            </div>
                            <a
                              href={getExplorerUrl(token.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>

                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-gray-500">Initial Supply</p>
                              <p className="text-white font-medium">
                                {BigInt(token.initialSupply).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Max Supply</p>
                              <p className="text-white font-medium">
                                {formatSupply(token.maxSupply)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Decimals</p>
                              <p className="text-white font-medium">{token.decimals}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Created</p>
                              <p className="text-white font-medium">
                                {new Date(token.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-[#D4F6D3]/10">
                            <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
                            <div className="flex items-center gap-2">
                              <code className="text-xs text-gray-400 font-mono truncate flex-1">
                                {token.txHash}
                              </code>
                              <button
                                onClick={() => copyToClipboard(token.txHash)}
                                className="p-1.5 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                              >
                                {copiedAddress === token.txHash ? (
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
    </div>
  );
}

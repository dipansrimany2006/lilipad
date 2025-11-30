"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";
import { MagicCard } from "@/components/ui/magic-card";
import {
  Upload,
  FolderGit2,
  Globe,
  FileText,
  Twitter,
  ArrowLeft,
  Coins,
  Plus,
  Loader2,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { triggerSideCannons } from "@/components/side-canons";
import {
  getWalletFungibleAssets,
  formatTokenBalance,
  type WalletToken,
} from "@/lib/lilipadClient";
import { shareToX, generateProjectShareText } from "@/lib/shareUtils";

const poppins = Poppins({ weight: ["200", "300", "400", "700"], subsets: ["latin"] });

const categories = [
  "DeFi",
  "NFT",
  "DAO",
  "Infrastructure",
  "Gaming",
  "Social",
  "AI",
  "Other"
];

// Demo data for quick fill
const demoProjects = [
  {
    name: "AptosSwap",
    category: "DeFi",
    description: "A next-generation decentralized exchange built on Aptos. AptosSwap offers lightning-fast swaps with minimal fees, concentrated liquidity pools, and advanced trading features for both retail and institutional users.",
    githubUrl: "https://github.com/aptosswap/core",
    websiteUrl: "https://aptosswap.io",
    docsUrl: "https://docs.aptosswap.io",
    xUrl: "https://x.com/aptosswap",
  },
  {
    name: "NexusDAO",
    category: "DAO",
    description: "Decentralized governance platform enabling communities to create, manage, and vote on proposals with on-chain execution. Features quadratic voting, delegation, and multi-sig treasury management.",
    githubUrl: "https://github.com/nexusdao/governance",
    websiteUrl: "https://nexusdao.xyz",
    docsUrl: "https://docs.nexusdao.xyz",
    xUrl: "https://x.com/nexusdao",
  },
  {
    name: "PixelVerse",
    category: "Gaming",
    description: "Play-to-earn metaverse game featuring unique NFT characters, land ownership, and an in-game economy. Build, explore, and compete in a fully decentralized virtual world.",
    githubUrl: "https://github.com/pixelverse/game",
    websiteUrl: "https://pixelverse.game",
    docsUrl: "https://docs.pixelverse.game",
    xUrl: "https://x.com/pixelversegame",
  },
];

export default function CreateProject() {
  const router = useRouter();
  const { account, connected } = useWallet();
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    image: null as File | null,
    githubUrl: "",
    websiteUrl: "",
    docsUrl: "",
    xUrl: "",
    projectToken: ""
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  // Token dropdown state
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [selectedToken, setSelectedToken] = useState<WalletToken | null>(null);
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

  // Fetch wallet tokens when connected
  useEffect(() => {
    const fetchTokens = async () => {
      if (connected && account?.address) {
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
  }, [connected, account?.address]);

  const handleSelectToken = (token: WalletToken) => {
    setSelectedToken(token);
    setFormData(prev => ({ ...prev, projectToken: token.metadata }));
    setShowTokenDropdown(false);
  };

  const fillDemoData = () => {
    const demo = demoProjects[Math.floor(Math.random() * demoProjects.length)];
    setFormData(prev => ({
      ...prev,
      name: demo.name,
      category: demo.category,
      description: demo.description,
      githubUrl: demo.githubUrl,
      websiteUrl: demo.websiteUrl,
      docsUrl: demo.docsUrl,
      xUrl: demo.xUrl,
      // Keep projectToken if already selected
      projectToken: prev.projectToken,
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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

  const handleShareToX = () => {
    const shareOptions = generateProjectShareText(formData.name, createdProjectId || undefined);
    shareToX(shareOptions);
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    router.push("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!connected || !account?.address) {
      setError("Please connect your wallet to create a project");
      return;
    }

    if (!formData.projectToken) {
      setError("Please select a token for your project");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          description: formData.description,
          imageUrl: imagePreview,
          githubUrl: formData.githubUrl || undefined,
          websiteUrl: formData.websiteUrl || undefined,
          docsUrl: formData.docsUrl || undefined,
          xUrl: formData.xUrl || undefined,
          projectToken: formData.projectToken,
          creatorWallet: account.address.toString(),
        }),
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response from API:", text);
        throw new Error("Server error: Invalid response format");
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create project");
      }

      // Store the created project ID for sharing
      if (data.data?.id) {
        setCreatedProjectId(data.data.id);
      }

      // Trigger confetti celebration
      triggerSideCannons();

      // Show success modal with share option
      setShowSuccessModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
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

            <section className="px-4 max-w-4xl mx-auto pb-24">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <Link
                    href="/"
                    className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                  <h2 className="text-4xl font-light text-white">
                    Create Project
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={fillDemoData}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0B1418] border border-[#D4F6D3]/30 text-[#D4F6D3] rounded-xl text-sm hover:bg-[#D4F6D3]/10 hover:border-[#D4F6D3]/50 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  Demo Fill
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400">
                  {error}
                </div>
              )}

              {/* Wallet Connection Warning */}
              {!connected && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-xl text-yellow-400">
                  Please connect your wallet to create a project
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Project Name & Category Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Project Name */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Enter project name"
                      required
                      className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                    />
                  </MagicCard>

                  {/* Category */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Category *
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white focus:outline-none focus:border-[#D4F6D3]/50 transition-all appearance-none cursor-pointer"
                    >
                      <option value="" disabled className="text-gray-500">Select a category</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat} className="bg-[#0B1418]">{cat}</option>
                      ))}
                    </select>
                  </MagicCard>
                </div>

                {/* Description */}
                <MagicCard
                  className="p-6 rounded-2xl"
                  gradientSize={200}
                  gradientFrom="#d4f6d3"
                  gradientTo="#0b1418"
                >
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Project Description *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Describe your project, its goals, and what makes it unique..."
                    required
                    rows={4}
                    className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all resize-none"
                  />
                </MagicCard>

                {/* Project Image */}
                <MagicCard
                  className="p-6 rounded-2xl"
                  gradientSize={200}
                  gradientFrom="#d4f6d3"
                  gradientTo="#0b1418"
                >
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Project Image
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

                {/* Project Token */}
                <MagicCard
                  className="p-6 rounded-2xl"
                  gradientSize={200}
                  gradientFrom="#d4f6d3"
                  gradientTo="#0b1418"
                >
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    <Coins className="inline h-4 w-4 mr-2" />
                    Project Token *
                  </label>
                  <div className="flex items-center gap-4">
                    {/* Token Selection Dropdown */}
                    <div className="relative flex-1" ref={dropdownRef}>
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
                              <p className="text-xs mt-1">Create a token first or connect a wallet with tokens</p>
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
                    <Link href="/tokens" className="flex">
                      <button
                        type="button"
                        className="flex items-center gap-2 px-6 py-3 bg-[#0B1418] border border-[#D4F6D3]/40 text-[#D4F6D3] rounded-xl font-medium hover:bg-[#D4F6D3]/10 hover:border-[#D4F6D3] transition-all"
                      >
                        <Plus className="h-4 w-4" />
                        Create Token
                      </button>
                    </Link>
                  </div>
                  {selectedToken && (
                    <p className="text-xs text-gray-500 mt-2 font-mono truncate">
                      {selectedToken.metadata}
                    </p>
                  )}
                  {!selectedToken && (
                    <p className="text-xs text-gray-500 mt-2">
                      Select a token from your wallet or create a new one
                    </p>
                  )}
                </MagicCard>

                {/* URLs Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* GitHub URL */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      <FolderGit2 className="inline h-4 w-4 mr-2" />
                      GitHub URL
                    </label>
                    <input
                      type="url"
                      name="githubUrl"
                      value={formData.githubUrl}
                      onChange={handleInputChange}
                      placeholder="https://github.com/your-project"
                      className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                    />
                  </MagicCard>

                  {/* Website URL */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      <Globe className="inline h-4 w-4 mr-2" />
                      Website URL
                    </label>
                    <input
                      type="url"
                      name="websiteUrl"
                      value={formData.websiteUrl}
                      onChange={handleInputChange}
                      placeholder="https://your-project.com"
                      className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                    />
                  </MagicCard>

                  {/* Docs/Whitepaper URL */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      <FileText className="inline h-4 w-4 mr-2" />
                      Docs / Whitepaper URL
                    </label>
                    <input
                      type="url"
                      name="docsUrl"
                      value={formData.docsUrl}
                      onChange={handleInputChange}
                      placeholder="https://docs.your-project.com"
                      className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                    />
                  </MagicCard>

                  {/* X (Twitter) URL */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      <Twitter className="inline h-4 w-4 mr-2" />
                      X (Twitter) URL
                    </label>
                    <input
                      type="url"
                      name="xUrl"
                      value={formData.xUrl}
                      onChange={handleInputChange}
                      placeholder="https://x.com/your-project"
                      className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                    />
                  </MagicCard>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting || !connected}
                    className="px-8 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
                    {isSubmitting ? "Creating..." : "Create Project"}
                  </button>
                </div>
              </form>

              {/* Success Modal with Share to X option */}
              {showSuccessModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                  <MagicCard
                    className="p-8 rounded-2xl max-w-md w-full text-center"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#D4F6D3]/20 flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-[#D4F6D3]" />
                    </div>
                    <h3 className="text-2xl font-light text-white mb-3">
                      Project Published!
                    </h3>
                    <p className="text-gray-400 mb-8">
                      Your project &quot;{formData.name}&quot; has been successfully created. Share it with the world!
                    </p>
                    <div className="space-y-3">
                      <button
                        onClick={handleShareToX}
                        className="w-full py-3 px-6 bg-black text-white rounded-xl font-medium hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 border border-gray-700"
                      >
                        <Twitter className="h-5 w-5" />
                        Share on X
                      </button>
                      <button
                        onClick={handleCloseSuccessModal}
                        className="w-full py-3 px-6 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                      >
                        Continue to Dashboard
                      </button>
                    </div>
                  </MagicCard>
                </div>
              )}
            </section>
          </main>
        </AppSidebar>
      </div>
    </div>
  );
}

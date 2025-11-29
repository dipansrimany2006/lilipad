"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";
import { MagicCard } from "@/components/ui/magic-card";
import {
  ArrowLeft,
  Github,
  Globe,
  FileText,
  ExternalLink,
  Coins,
  Wallet,
  Calendar,
  Users,
  TrendingUp,
  Loader2,
  Copy,
  Check,
  Rocket,
  Clock,
  Target,
  BadgeCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  getSaleCounter,
  getSale,
  getTokenInfo,
  formatAptAmount,
  priceToApt,
  type SaleInfo,
  type TokenInfo,
} from "@/lib/lilipadClient";
import { NETWORK } from "@/constants";

const poppins = Poppins({ weight: ["200", "300", "400", "700"], subsets: ["latin"] });

interface Project {
  id: string;
  name: string;
  category: string;
  description: string;
  image_url?: string;
  github_url?: string;
  website_url?: string;
  docs_url?: string;
  x_url?: string;
  project_token: string;
  creator_wallet: string;
  funding_amount: number;
  backers_count: number;
  created_at: string;
  updated_at: string;
}

interface ActiveSale extends SaleInfo {
  tokenInfo?: TokenInfo;
}

export default function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const { account, connected } = useWallet();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [activeSales, setActiveSales] = useState<ActiveSale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // Fetch project data
  useEffect(() => {
    async function fetchProject() {
      if (!projectId) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/projects/${projectId}`);
        const data = await response.json();

        if (data.success) {
          setProject(data.project);
        } else {
          setError(data.error || "Project not found");
        }
      } catch (err) {
        setError("Failed to fetch project");
        console.error("Error fetching project:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [projectId]);

  // Fetch active sales for this project's token
  useEffect(() => {
    async function fetchSales() {
      if (!project?.project_token) return;

      setLoadingSales(true);
      try {
        const saleCounter = await getSaleCounter();
        const sales: ActiveSale[] = [];

        // Check recent sales (last 50)
        const startId = Math.max(0, saleCounter - 50);
        for (let i = startId; i < saleCounter; i++) {
          try {
            const sale = await getSale(i);
            // Match by token address
            if (sale.token.toLowerCase() === project.project_token.toLowerCase()) {
              // Try to get token info
              let tokenInfo: TokenInfo | undefined;
              try {
                tokenInfo = await getTokenInfo(sale.token);
              } catch {}

              sales.push({ ...sale, tokenInfo });
            }
          } catch {}
        }

        setActiveSales(sales);
      } catch (err) {
        console.error("Failed to fetch sales:", err);
      } finally {
        setLoadingSales(false);
      }
    }

    fetchSales();
  }, [project?.project_token]);

  // Copy address
  const handleCopy = async (address: string, type: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(type);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Get sale status
  const getSaleStatus = (sale: SaleInfo) => {
    const now = Math.floor(Date.now() / 1000);
    if (now < sale.startTs) return { status: "upcoming", label: "Upcoming", color: "text-yellow-400" };
    if (now > sale.endTs) return { status: "ended", label: "Ended", color: "text-gray-400" };
    if (sale.tokensSold >= sale.totalTokens) return { status: "sold_out", label: "Sold Out", color: "text-red-400" };
    return { status: "active", label: "Active", color: "text-green-400" };
  };

  // Calculate progress
  const calculateProgress = (sale: SaleInfo) => {
    if (sale.totalTokens === BigInt(0)) return 0;
    return Number((sale.tokensSold * BigInt(100)) / sale.totalTokens);
  };

  if (loading) {
    return (
      <div className={`flex flex-col h-screen w-screen overflow-hidden bg-[url('/image/bg.png')] bg-cover ${poppins.className}`}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-12 w-12 text-[#D4F6D3] animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className={`flex flex-col h-screen w-screen overflow-hidden bg-[url('/image/bg.png')] bg-cover ${poppins.className}`}>
        <Navbar />
        <div className="flex-1 flex overflow-hidden">
          <AppSidebar>
            <main className="flex-1 overflow-auto p-4">
              <SidebarTrigger className="mb-4" />
              <div className="max-w-4xl mx-auto">
                <button
                  onClick={() => router.back()}
                  className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back
                </button>
                <div className="text-center py-20">
                  <p className="text-red-400 text-xl">{error || "Project not found"}</p>
                  <Link href="/" className="text-[#D4F6D3] mt-4 inline-block hover:underline">
                    Return to Home
                  </Link>
                </div>
              </div>
            </main>
          </AppSidebar>
        </div>
      </div>
    );
  }

  const isCreator = connected && account?.address?.toString().toLowerCase() === project.creator_wallet.toLowerCase();

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden bg-[url('/image/bg.png')] bg-cover ${poppins.className}`}>
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar>
          <main className="flex-1 overflow-auto p-4">
            <SidebarTrigger className="mb-4" />

            <div className="max-w-4xl mx-auto">
              {/* Back Button */}
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                Back to Projects
              </button>

              {/* Project Header */}
              <MagicCard className="p-6 rounded-2xl mb-6" gradientSize={300} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Project Image */}
                  <div className="relative w-full md:w-48 h-48 flex-shrink-0 rounded-xl overflow-hidden bg-white/5">
                    {project.image_url ? (
                      <Image
                        src={project.image_url}
                        alt={project.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-6xl font-bold text-[#d4f6d3]/50">
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Project Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h1 className="text-3xl font-semibold text-white mb-2">{project.name}</h1>
                        <span className="px-3 py-1 bg-[#d4f6d3] text-[#0b1418] rounded-full text-sm font-medium">
                          {project.category}
                        </span>
                      </div>
                      {isCreator && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-[#D4F6D3]/20 rounded-full">
                          <BadgeCheck className="h-4 w-4 text-[#D4F6D3]" />
                          <span className="text-[#D4F6D3] text-sm">Your Project</span>
                        </div>
                      )}
                    </div>

                    <p className="text-gray-300 leading-relaxed mb-4">
                      {project.description}
                    </p>

                    {/* Stats */}
                    <div className="flex flex-wrap gap-4 mb-4">
                      <div className="flex items-center gap-2 text-gray-400">
                        <TrendingUp className="h-4 w-4 text-[#D4F6D3]" />
                        <span>{project.funding_amount.toFixed(2)} APT raised</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <Users className="h-4 w-4 text-[#D4F6D3]" />
                        <span>{project.backers_count} backers</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <Calendar className="h-4 w-4 text-[#D4F6D3]" />
                        <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap gap-2">
                      {project.website_url && (
                        <a
                          href={project.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
                        >
                          <Globe className="h-4 w-4" />
                          Website
                        </a>
                      )}
                      {project.github_url && (
                        <a
                          href={project.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
                        >
                          <Github className="h-4 w-4" />
                          GitHub
                        </a>
                      )}
                      {project.docs_url && (
                        <a
                          href={project.docs_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
                        >
                          <FileText className="h-4 w-4" />
                          Docs
                        </a>
                      )}
                      {project.x_url && (
                        <a
                          href={project.x_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
                        >
                          <ExternalLink className="h-4 w-4" />
                          X (Twitter)
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </MagicCard>

              {/* Token & Creator Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Token Card */}
                <MagicCard className="p-4 rounded-xl" gradientSize={150} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                    <Coins className="h-5 w-5 text-[#D4F6D3]" />
                    Project Token
                  </h3>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <code className="text-sm text-gray-300 font-mono">
                        {project.project_token.slice(0, 20)}...{project.project_token.slice(-8)}
                      </code>
                      <button
                        onClick={() => handleCopy(project.project_token, "token")}
                        className="p-1.5 hover:bg-white/10 rounded transition-colors"
                      >
                        {copiedAddress === "token" ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <a
                    href={`https://explorer.aptoslabs.com/account/${project.project_token}?network=${NETWORK}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-sm text-[#D4F6D3] hover:underline flex items-center gap-1"
                  >
                    View on Explorer <ExternalLink className="h-3 w-3" />
                  </a>
                </MagicCard>

                {/* Creator Card */}
                <MagicCard className="p-4 rounded-xl" gradientSize={150} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                  <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-[#D4F6D3]" />
                    Creator Wallet
                  </h3>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <code className="text-sm text-gray-300 font-mono">
                        {project.creator_wallet.slice(0, 20)}...{project.creator_wallet.slice(-8)}
                      </code>
                      <button
                        onClick={() => handleCopy(project.creator_wallet, "creator")}
                        className="p-1.5 hover:bg-white/10 rounded transition-colors"
                      >
                        {copiedAddress === "creator" ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <a
                    href={`https://explorer.aptoslabs.com/account/${project.creator_wallet}?network=${NETWORK}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-sm text-[#D4F6D3] hover:underline flex items-center gap-1"
                  >
                    View on Explorer <ExternalLink className="h-3 w-3" />
                  </a>
                </MagicCard>
              </div>

              {/* Active Sales */}
              <MagicCard className="p-6 rounded-2xl mb-6" gradientSize={250} gradientFrom="#d4f6d3" gradientTo="#0b1418">
                <h3 className="text-xl font-medium text-white mb-4 flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-[#D4F6D3]" />
                  Token Sales
                </h3>

                {loadingSales ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 text-[#D4F6D3] animate-spin" />
                  </div>
                ) : activeSales.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">No active sales for this project</p>
                    {isCreator && (
                      <Link
                        href="/launch"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                      >
                        <Rocket className="h-4 w-4" />
                        Create a Sale
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeSales.map((sale) => {
                      const status = getSaleStatus(sale);
                      const progress = calculateProgress(sale);

                      return (
                        <div key={sale.id} className="bg-white/5 rounded-xl p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-white font-medium">
                                  Sale #{sale.id}
                                </span>
                                <span className={`text-sm ${status.color}`}>
                                  • {status.label}
                                </span>
                              </div>
                              {sale.tokenInfo && (
                                <span className="text-gray-400 text-sm">
                                  {sale.tokenInfo.name} ({sale.tokenInfo.symbol})
                                </span>
                              )}
                            </div>
                            <Link
                              href="/launch"
                              className="px-3 py-1.5 bg-[#D4F6D3] text-[#0B1418] rounded-lg text-sm font-medium hover:bg-[#c2e8c1] transition-colors"
                            >
                              View Sale
                            </Link>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-400">Progress</span>
                              <span className="text-white">{progress}%</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#D4F6D3] rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>

                          {/* Sale Stats */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-gray-400 block">Price</span>
                              <span className="text-white">{priceToApt(sale.pricePerToken)} APT</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block">Raised</span>
                              <span className="text-white">{formatAptAmount(sale.raisedApt)} APT</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block">Soft Cap</span>
                              <span className="text-white">{formatAptAmount(sale.softCap)} APT</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {status.status === "upcoming" ? "Starts" : "Ends"}
                              </span>
                              <span className="text-white">
                                {status.status === "upcoming"
                                  ? new Date(sale.startTs * 1000).toLocaleDateString()
                                  : new Date(sale.endTs * 1000).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </MagicCard>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/launch"
                  className="flex items-center gap-2 px-5 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                >
                  <Rocket className="h-5 w-5" />
                  Go to Launchpad
                </Link>
                <Link
                  href="/trade"
                  className="flex items-center gap-2 px-5 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
                >
                  <TrendingUp className="h-5 w-5" />
                  Trade Token
                </Link>
              </div>
            </div>
          </main>
        </AppSidebar>
      </div>
    </div>
  );
}

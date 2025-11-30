"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";
import { MagicCard } from "@/components/ui/magic-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Rocket,
  Plus,
  TrendingUp,
  Target,
  Coins,
  ArrowRight,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Droplets,
  BarChart3,
  PieChart,
  Activity,
  Calendar as CalendarIcon,
  ArrowLeft,
  Zap,
  Shield,
  Timer,
  Sparkles,
  Twitter,
} from "lucide-react";
import { DefiTooltip } from "@/components/defi-tooltip";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { format } from "date-fns";
import {
  aptos,
  getSale,
  getSaleCounter,
  buildCreateSalePayload,
  buildDepositSaleTokensPayload,
  buildBuyPayload,
  buildWithdrawProceedsPayload,
  getWalletFungibleAssets,
  formatTokenBalance,
  parseTokenAmount,
  aptToPrice,
  priceToApt,
  formatAptAmount,
  PRICE_PRECISION,
  type SaleInfo,
  type WalletToken,
  type CreateSaleParams,
} from "@/lib/lilipadClient";
import { NETWORK } from "@/constants";
import { shareToX, generateFairLaunchShareText } from "@/lib/shareUtils";

const poppins = Poppins({ weight: ["200", "300", "400", "700"], subsets: ["latin"] });

// Project interface for localStorage
interface StoredProject {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  docsUrl?: string;
  xUrl?: string;
  createdAt: number;
  owner: string;
}

// Stored sale info for localStorage
interface StoredSale {
  saleId: number;
  projectName: string;
  projectId?: string;
  tokenSymbol: string;
  tokenMetadata: string;
  createdAt: number;
  txHash: string;
  owner: string;
}


export default function Launch() {
  const { account, signAndSubmitTransaction, connected } = useWallet();
  const [activeTab, setActiveTab] = useState("explore");
  const [isLoading, setIsLoading] = useState(true);
  const [sales, setSales] = useState<(SaleInfo & { stored?: StoredSale })[]>([]);
  const [selectedSale, setSelectedSale] = useState<(SaleInfo & { stored?: StoredSale }) | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; message: string } | null>(null);
  const [createStep, setCreateStep] = useState<"project" | "token" | "details" | "review">("project");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Sale form data
  const [saleFormData, setSaleFormData] = useState({
    tokenMetadata: "",
    totalTokens: "",
    pricePerToken: "",
    startDate: null as Date | null,
    startTime: "12:00",
    endDate: null as Date | null,
    endTime: "12:00",
    softCap: "",
  });

  // Buy form data
  const [buyAmount, setBuyAmount] = useState("");
  const [vestingDays, setVestingDays] = useState("30");
  const [isBuying, setIsBuying] = useState(false);

  // Success modal state for fair launch creation
  const [showLaunchSuccessModal, setShowLaunchSuccessModal] = useState(false);
  const [createdSaleInfo, setCreatedSaleInfo] = useState<{
    projectName: string;
    tokenSymbol: string;
    saleId: number;
  } | null>(null);

  // Load data on mount and when account changes
  useEffect(() => {
    loadSales();
    loadProjects();
  }, [account?.address]);

  // Load wallet tokens when connected
  useEffect(() => {
    if (connected && account?.address) {
      loadWalletTokens();
    } else {
      setWalletTokens([]);
    }
  }, [connected, account?.address]);

  // Demo/Test sales data for testing UI
  const getDemoSales = (): (SaleInfo & { stored?: StoredSale })[] => {
    const now = Math.floor(Date.now() / 1000);

    return [
      // Active sale - currently running
      {
        id: 9001,
        projectPointerOpt: null,
        owner: "0xdemo1234567890abcdef",
        token: "0xdemo_token_active",
        totalTokens: BigInt(1000000) * BigInt(1e8),
        tokensSold: BigInt(350000) * BigInt(1e8),
        pricePerToken: BigInt(100000000), // 0.1 APT
        startTs: now - 86400, // Started 1 day ago
        endTs: now + 86400 * 6, // Ends in 6 days
        softCap: BigInt(50000) * BigInt(1e8),
        raisedApt: BigInt(35000) * BigInt(1e8),
        escrowed: true,
        softCapReached: false,
        stored: {
          saleId: 9001,
          projectName: "Stellaryx",
          tokenSymbol: "STLX",
          tokenMetadata: "0xdemo_token_active",
          createdAt: Date.now() - 86400000,
          txHash: "0xdemo_tx_1",
          owner: "0xdemo1234567890abcdef",
        },
      },
      // Active sale with soft cap reached
      {
        id: 9002,
        projectPointerOpt: null,
        owner: "0xdemo_owner_2",
        token: "0xdemo_token_gaming",
        totalTokens: BigInt(5000000) * BigInt(1e8),
        tokensSold: BigInt(4200000) * BigInt(1e8),
        pricePerToken: BigInt(50000000), // 0.05 APT
        startTs: now - 172800, // Started 2 days ago
        endTs: now + 86400 * 2, // Ends in 2 days
        softCap: BigInt(100000) * BigInt(1e8),
        raisedApt: BigInt(210000) * BigInt(1e8),
        escrowed: true,
        softCapReached: true,
        stored: {
          saleId: 9002,
          projectName: "Pixelmon Realms",
          tokenSymbol: "PXLM",
          tokenMetadata: "0xdemo_token_gaming",
          createdAt: Date.now() - 172800000,
          txHash: "0xdemo_tx_2",
          owner: "0xdemo_owner_2",
        },
      },
      // Upcoming sale
      {
        id: 9003,
        projectPointerOpt: null,
        owner: "0xdemo_owner_3",
        token: "0xdemo_token_nft",
        totalTokens: BigInt(2000000) * BigInt(1e8),
        tokensSold: BigInt(0),
        pricePerToken: BigInt(200000000), // 0.2 APT
        startTs: now + 86400 * 3, // Starts in 3 days
        endTs: now + 86400 * 10, // Ends in 10 days
        softCap: BigInt(200000) * BigInt(1e8),
        raisedApt: BigInt(0),
        escrowed: true,
        softCapReached: false,
        stored: {
          saleId: 9003,
          projectName: "Chromavault",
          tokenSymbol: "CHRM",
          tokenMetadata: "0xdemo_token_nft",
          createdAt: Date.now(),
          txHash: "0xdemo_tx_3",
          owner: "0xdemo_owner_3",
        },
      },
      // Ended sale - completed
      {
        id: 9004,
        projectPointerOpt: null,
        owner: "0xdemo_owner_4",
        token: "0xdemo_token_dao",
        totalTokens: BigInt(500000) * BigInt(1e8),
        tokensSold: BigInt(500000) * BigInt(1e8),
        pricePerToken: BigInt(150000000), // 0.15 APT
        startTs: now - 86400 * 14, // Started 14 days ago
        endTs: now - 86400 * 7, // Ended 7 days ago
        softCap: BigInt(50000) * BigInt(1e8),
        raisedApt: BigInt(75000) * BigInt(1e8),
        escrowed: true,
        softCapReached: true,
        stored: {
          saleId: 9004,
          projectName: "Zenith Collective",
          tokenSymbol: "ZNTH",
          tokenMetadata: "0xdemo_token_dao",
          createdAt: Date.now() - 86400000 * 14,
          txHash: "0xdemo_tx_4",
          owner: "0xdemo_owner_4",
        },
      },
      // Another upcoming - AI project
      {
        id: 9005,
        projectPointerOpt: null,
        owner: "0xdemo_owner_5",
        token: "0xdemo_token_ai",
        totalTokens: BigInt(10000000) * BigInt(1e8),
        tokensSold: BigInt(0),
        pricePerToken: BigInt(10000000), // 0.01 APT
        startTs: now + 86400 * 7, // Starts in 7 days
        endTs: now + 86400 * 21, // Ends in 21 days
        softCap: BigInt(50000) * BigInt(1e8),
        raisedApt: BigInt(0),
        escrowed: true,
        softCapReached: false,
        stored: {
          saleId: 9005,
          projectName: "NeuralForge",
          tokenSymbol: "NFRG",
          tokenMetadata: "0xdemo_token_ai",
          createdAt: Date.now(),
          txHash: "0xdemo_tx_5",
          owner: "0xdemo_owner_5",
        },
      },
    ];
  };

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const loadedSales: (SaleInfo & { stored?: StoredSale })[] = [];

      // Load stored sales from localStorage for mapping
      const storedData = localStorage.getItem("lilipad_sales");
      let stored: StoredSale[] = [];
      if (storedData) {
        try {
          stored = JSON.parse(storedData);
        } catch {
          console.error("Invalid JSON in lilipad_sales, clearing storage");
          localStorage.removeItem("lilipad_sales");
        }
      }

      // Try to load real sales from chain
      try {
        const counter = await getSaleCounter();
        for (let i = 0; i < counter; i++) {
          try {
            const sale = await getSale(i);
            const storedInfo = stored.find((s) => s.saleId === i);
            loadedSales.push({ ...sale, stored: storedInfo });
          } catch (e) {
            console.error(`Failed to load sale ${i}:`, e);
          }
        }
      } catch (e) {
        console.log("Could not load on-chain sales, using demo data only");
      }

      // Add demo sales for testing
      const demoSales = getDemoSales();
      loadedSales.push(...demoSales);

      setSales(loadedSales);
    } catch (e) {
      console.error("Failed to load sales:", e);
      // Still show demo sales even if everything fails
      setSales(getDemoSales());
    } finally {
      setIsLoading(false);
    }
  };


  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      // Only load projects if wallet is connected
      if (!account?.address) {
        setProjects([]);
        return;
      }

      const walletAddress = account.address.toString();

      // Fetch projects from API (D1 database via Cloudflare Worker)
      try {
        const response = await fetch("/api/projects");
        if (response.ok) {
          // Check if response is JSON before parsing
          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            console.error("Non-JSON response from API");
            throw new Error("Invalid API response format");
          }
          const data = await response.json();

          // Handle both response formats: data.projects (home page format) or data.data
          const projectsArray = data.projects || data.data || [];

          if (data.success && Array.isArray(projectsArray)) {
            // Filter by current user's wallet (creator_wallet matches connected wallet)
            const userProjects = projectsArray
              .filter((p: { creator_wallet: string }) =>
                p.creator_wallet.toLowerCase() === walletAddress.toLowerCase()
              )
              .map((p: { id: string; name: string; category: string; description: string; image_url?: string; github_url?: string; website_url?: string; docs_url?: string; x_url?: string; created_at: string; creator_wallet: string }) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                description: p.description,
                imageUrl: p.image_url,
                githubUrl: p.github_url,
                websiteUrl: p.website_url,
                docsUrl: p.docs_url,
                xUrl: p.x_url,
                createdAt: new Date(p.created_at).getTime(),
                owner: p.creator_wallet,
              }));

            setProjects(userProjects);
          } else {
            console.error("Invalid API response structure:", data);
            setProjects([]);
          }
        } else {
          console.error("API request failed with status:", response.status);
          setProjects([]);
        }
      } catch (apiError) {
        console.error("Failed to fetch projects from API:", apiError);
        setProjects([]);
      }
    } catch (e) {
      console.error("Failed to load projects:", e);
      setProjects([]);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const loadWalletTokens = async () => {
    if (!account?.address) return;
    try {
      const tokens = await getWalletFungibleAssets(account.address.toString());
      setWalletTokens(tokens);
    } catch (e) {
      console.error("Failed to load wallet tokens:", e);
    }
  };

  // Demo fill functions
  const fillDemoSaleDetails = () => {
    const now = new Date();
    const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

    setSaleFormData(prev => ({
      ...prev,
      totalTokens: "1000000",
      pricePerToken: "0.001",
      startDate,
      startTime: "12:00",
      endDate,
      endTime: "12:00",
      softCap: "500",
    }));
  };

  // Selected token info
  const selectedToken = useMemo(() => {
    return walletTokens.find((t) => t.metadata === saleFormData.tokenMetadata);
  }, [walletTokens, saleFormData.tokenMetadata]);

  // Calculate sale metrics
  const getSaleMetrics = (sale: SaleInfo) => {
    const now = Math.floor(Date.now() / 1000);
    const progress =
      sale.totalTokens > 0
        ? Number((sale.tokensSold * BigInt(100)) / sale.totalTokens)
        : 0;
    const softCapProgress =
      sale.softCap > 0
        ? Math.min(Number((sale.raisedApt * BigInt(100)) / sale.softCap), 100)
        : 0;
    const isActive = now >= sale.startTs && now <= sale.endTs && sale.escrowed;
    const hasEnded = now > sale.endTs;
    const isUpcoming = now < sale.startTs;
    const timeRemaining = isActive ? sale.endTs - now : 0;

    return {
      progress,
      softCapProgress,
      isActive,
      hasEnded,
      isUpcoming,
      timeRemaining,
    };
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return "Ended";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Handle sale creation
  const handleCreateSale = async () => {
    if (!connected || !account) {
      setTxResult({ success: false, message: "Please connect your wallet" });
      return;
    }

    // Validate form
    if (
      !saleFormData.tokenMetadata ||
      !saleFormData.totalTokens ||
      !saleFormData.pricePerToken ||
      !saleFormData.startDate ||
      !saleFormData.endDate ||
      !saleFormData.softCap
    ) {
      setTxResult({ success: false, message: "Please fill in all required fields" });
      return;
    }

    if (!selectedToken) {
      setTxResult({ success: false, message: "Please select a valid token" });
      return;
    }

    setIsSubmitting(true);
    setTxResult(null);

    try {
      // Parse values
      const totalTokens = parseTokenAmount(saleFormData.totalTokens, selectedToken.decimals);
      const pricePerToken = aptToPrice(saleFormData.pricePerToken);
      const softCap = BigInt(Math.floor(parseFloat(saleFormData.softCap) * 1e8)); // APT in octas

      // Parse timestamps
      const [startHour, startMin] = saleFormData.startTime.split(":").map(Number);
      const [endHour, endMin] = saleFormData.endTime.split(":").map(Number);

      const startDate = new Date(saleFormData.startDate);
      startDate.setHours(startHour, startMin, 0, 0);
      const startTs = Math.floor(startDate.getTime() / 1000);

      const endDate = new Date(saleFormData.endDate);
      endDate.setHours(endHour, endMin, 0, 0);
      const endTs = Math.floor(endDate.getTime() / 1000);

      // Validate times
      const now = Math.floor(Date.now() / 1000);
      if (startTs <= now) {
        setTxResult({ success: false, message: "Start time must be in the future" });
        setIsSubmitting(false);
        return;
      }
      if (endTs <= startTs) {
        setTxResult({ success: false, message: "End time must be after start time" });
        setIsSubmitting(false);
        return;
      }

      // Validate balance
      if (totalTokens > selectedToken.balance) {
        setTxResult({ success: false, message: "Insufficient token balance" });
        setIsSubmitting(false);
        return;
      }

      // Create sale
      const params: CreateSaleParams = {
        token: saleFormData.tokenMetadata,
        totalTokens,
        pricePerToken,
        startTs,
        endTs,
        softCap,
      };

      const payload = buildCreateSalePayload(params);
      const response = await signAndSubmitTransaction({ data: payload });
      await aptos.waitForTransaction({ transactionHash: response.hash });

      // Get the new sale ID
      const newCounter = await getSaleCounter();
      const newSaleId = newCounter - 1;

      // Now deposit the tokens
      const depositPayload = buildDepositSaleTokensPayload(newSaleId, totalTokens);
      const depositResponse = await signAndSubmitTransaction({ data: depositPayload });
      await aptos.waitForTransaction({ transactionHash: depositResponse.hash });

      // Store sale info
      const storedSale: StoredSale = {
        saleId: newSaleId,
        projectName: projects.find((p) => p.id === selectedProjectId)?.name || "Unknown",
        projectId: selectedProjectId,
        tokenSymbol: selectedToken.symbol,
        tokenMetadata: saleFormData.tokenMetadata,
        createdAt: Date.now(),
        txHash: response.hash,
        owner: account.address.toString(),
      };

      const stored = localStorage.getItem("lilipad_sales");
      let allSales: StoredSale[] = [];
      if (stored) {
        try {
          allSales = JSON.parse(stored);
        } catch {
          console.error("Invalid JSON in lilipad_sales, resetting");
          localStorage.removeItem("lilipad_sales");
        }
      }
      allSales.push(storedSale);
      localStorage.setItem("lilipad_sales", JSON.stringify(allSales));

      // Store created sale info for share modal
      setCreatedSaleInfo({
        projectName: projects.find((p) => p.id === selectedProjectId)?.name || "Unknown",
        tokenSymbol: selectedToken.symbol,
        saleId: newSaleId,
      });

      // Show success modal with share option
      setShowLaunchSuccessModal(true);

      // Reset form
      setShowCreateForm(false);
      setCreateStep("project");
      setSaleFormData({
        tokenMetadata: "",
        totalTokens: "",
        pricePerToken: "",
        startDate: null,
        startTime: "12:00",
        endDate: null,
        endTime: "12:00",
        softCap: "",
      });
      setSelectedProjectId("");

      // Reload sales
      await loadSales();
      loadProjects();
    } catch (e) {
      console.error("Sale creation failed:", e);
      setTxResult({
        success: false,
        message: e instanceof Error ? e.message : "Transaction failed",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle buy tokens
  const handleBuyTokens = async () => {
    if (!connected || !account || !selectedSale) return;

    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      setTxResult({ success: false, message: "Please enter a valid amount" });
      return;
    }

    setIsBuying(true);
    setTxResult(null);

    try {
      const aptAmount = BigInt(Math.floor(parseFloat(buyAmount) * 1e8)); // Convert APT to octas
      const vestingDuration = parseInt(vestingDays) * 86400; // Convert days to seconds

      const payload = buildBuyPayload(selectedSale.id, aptAmount, vestingDuration);
      const response = await signAndSubmitTransaction({ data: payload });
      await aptos.waitForTransaction({ transactionHash: response.hash });

      setTxResult({
        success: true,
        message: "Purchase successful! Tokens will vest over your selected period.",
      });

      setBuyAmount("");
      await loadSales();

      // Update selected sale
      const updatedSale = await getSale(selectedSale.id);
      setSelectedSale({ ...updatedSale, stored: selectedSale.stored });
    } catch (e) {
      console.error("Buy failed:", e);
      setTxResult({
        success: false,
        message: e instanceof Error ? e.message : "Transaction failed",
      });
    } finally {
      setIsBuying(false);
    }
  };

  // Handle withdraw proceeds
  const handleWithdrawProceeds = async () => {
    if (!connected || !account || !selectedSale) return;

    setIsBuying(true);
    setTxResult(null);

    try {
      const payload = buildWithdrawProceedsPayload(selectedSale.id, account.address.toString());
      const response = await signAndSubmitTransaction({ data: payload });
      await aptos.waitForTransaction({ transactionHash: response.hash });

      setTxResult({
        success: true,
        message: "Proceeds withdrawn successfully!",
      });

      await loadSales();
      const updatedSale = await getSale(selectedSale.id);
      setSelectedSale({ ...updatedSale, stored: selectedSale.stored });
    } catch (e) {
      console.error("Withdraw failed:", e);
      setTxResult({
        success: false,
        message: e instanceof Error ? e.message : "Transaction failed",
      });
    } finally {
      setIsBuying(false);
    }
  };

  // Calculate tokens for APT amount
  const tokensForApt = useMemo(() => {
    if (!selectedSale || !buyAmount || parseFloat(buyAmount) <= 0) return BigInt(0);
    const aptOctas = BigInt(Math.floor(parseFloat(buyAmount) * 1e8));
    return (aptOctas * PRICE_PRECISION) / selectedSale.pricePerToken;
  }, [selectedSale, buyAmount]);

  // Filter sales by tab
  const filteredSales = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return sales.filter((sale) => {
      if (activeTab === "explore") return sale.escrowed;
      if (activeTab === "active") return sale.escrowed && now >= sale.startTs && now <= sale.endTs;
      if (activeTab === "upcoming") return sale.escrowed && now < sale.startTs;
      if (activeTab === "ended") return now > sale.endTs;
      if (activeTab === "my-launches")
        return account?.address && sale.owner === account.address.toString();
      return true;
    });
  }, [sales, activeTab, account?.address]);

  // Analytics data
  const analytics = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const activeSales = sales.filter((s) => s.escrowed && now >= s.startTs && now <= s.endTs);
    const totalRaised = sales.reduce((sum, s) => sum + s.raisedApt, BigInt(0));
    const totalTokensSold = sales.reduce((sum, s) => sum + s.tokensSold, BigInt(0));

    return {
      totalSales: sales.length,
      activeSales: activeSales.length,
      totalRaised,
      totalTokensSold,
    };
  }, [sales]);

  const getExplorerUrl = (txHash: string) => {
    return `https://explorer.aptoslabs.com/txn/${txHash}?network=${NETWORK}`;
  };

  // Handle share to X after fair launch creation
  const handleShareLaunchToX = () => {
    if (createdSaleInfo) {
      const shareOptions = generateFairLaunchShareText(
        createdSaleInfo.projectName,
        createdSaleInfo.tokenSymbol,
        createdSaleInfo.saleId
      );
      shareToX(shareOptions);
    }
  };

  const handleCloseLaunchSuccessModal = () => {
    setShowLaunchSuccessModal(false);
    setCreatedSaleInfo(null);
  };

  // Check if a sale is a demo sale
  const isDemoSale = (saleId: number) => saleId >= 9001 && saleId <= 9005;

  // Render sale card
  const renderSaleCard = (sale: SaleInfo & { stored?: StoredSale }) => {
    const metrics = getSaleMetrics(sale);
    const isDemo = isDemoSale(sale.id);

    return (
      <MagicCard
        key={sale.id}
        className="p-6 rounded-2xl cursor-pointer hover:border-[#D4F6D3]/50 transition-all relative"
        gradientSize={200}
        gradientFrom="#d4f6d3"
        gradientTo="#0b1418"
        onClick={() => setSelectedSale(sale)}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-medium text-white">
              {sale.stored?.projectName || `Sale #${sale.id}`}
            </h3>
            <p className="text-[#D4F6D3] font-mono text-sm">
              ${sale.stored?.tokenSymbol || "TOKEN"}
            </p>
          </div>
          <Badge
            className={`${
              metrics.isActive
                ? "bg-green-500/20 text-green-400 border-green-500/30"
                : metrics.isUpcoming
                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                : "bg-gray-500/20 text-gray-400 border-gray-500/30"
            }`}
          >
            {metrics.isActive ? "Live" : metrics.isUpcoming ? "Upcoming" : "Ended"}
          </Badge>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Progress</span>
            <span className="text-white">{metrics.progress.toFixed(1)}%</span>
          </div>
          <Progress value={metrics.progress} className="h-2 bg-[#D4F6D3]/10" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Raised</p>
            <p className="text-white font-medium">{formatAptAmount(sale.raisedApt)} APT</p>
          </div>
          <div>
            <p className="text-gray-500">Price</p>
            <p className="text-white font-medium">{priceToApt(sale.pricePerToken)} APT</p>
          </div>
          <div>
            <DefiTooltip term="softCap">
              <p className="text-gray-500">Soft Cap</p>
            </DefiTooltip>
            <p className="text-white font-medium">{formatAptAmount(sale.softCap)} APT</p>
          </div>
          <div>
            <p className="text-gray-500">
              {metrics.isActive ? "Time Left" : metrics.isUpcoming ? "Starts In" : "Status"}
            </p>
            <p className="text-white font-medium">
              {metrics.isActive
                ? formatTimeRemaining(metrics.timeRemaining)
                : metrics.isUpcoming
                ? formatTimeRemaining(sale.startTs - Math.floor(Date.now() / 1000))
                : "Completed"}
            </p>
          </div>
        </div>

        {/* Soft Cap Indicator */}
        {sale.softCapReached && (
          <div className="mt-4 flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Soft Cap Reached
          </div>
        )}
      </MagicCard>
    );
  };

  // Render sale detail view
  const renderSaleDetail = () => {
    if (!selectedSale) return null;
    const metrics = getSaleMetrics(selectedSale);
    const isOwner = account?.address?.toString() === selectedSale.owner;

    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setSelectedSale(null)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sales
        </button>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-light text-white mb-2">
              {selectedSale.stored?.projectName || `Sale #${selectedSale.id}`}
            </h2>
            <div className="flex items-center gap-3">
              <Badge
                className={
                  metrics.isActive
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : metrics.isUpcoming
                    ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                }
              >
                {metrics.isActive ? "Live" : metrics.isUpcoming ? "Upcoming" : "Ended"}
              </Badge>
              {selectedSale.softCapReached && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Soft Cap Reached
                </Badge>
              )}
            </div>
          </div>
          {selectedSale.stored?.txHash && (
            <a
              href={getExplorerUrl(selectedSale.stored.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-[#0B1418] border border-[#D4F6D3]/20 text-gray-400 hover:text-white hover:border-[#D4F6D3]/50 transition-all"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* Analytics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MagicCard
            className="p-4 rounded-xl"
            gradientSize={150}
            gradientFrom="#d4f6d3"
            gradientTo="#0b1418"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#D4F6D3]/10">
                <Coins className="h-5 w-5 text-[#D4F6D3]" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Raised</p>
                <p className="text-lg font-medium text-white">
                  {formatAptAmount(selectedSale.raisedApt)} APT
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
              <div className="p-2 rounded-lg bg-[#D4F6D3]/10">
                <PieChart className="h-5 w-5 text-[#D4F6D3]" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Tokens Sold</p>
                <p className="text-lg font-medium text-white">
                  {metrics.progress.toFixed(1)}%
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
              <div className="p-2 rounded-lg bg-[#D4F6D3]/10">
                <Target className="h-5 w-5 text-[#D4F6D3]" />
              </div>
              <div>
                <DefiTooltip term="softCap">
                  <p className="text-xs text-gray-500">Soft Cap Progress</p>
                </DefiTooltip>
                <p className="text-lg font-medium text-white">
                  {metrics.softCapProgress.toFixed(1)}%
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
              <div className="p-2 rounded-lg bg-[#D4F6D3]/10">
                <Timer className="h-5 w-5 text-[#D4F6D3]" />
              </div>
              <div>
                <p className="text-xs text-gray-500">
                  {metrics.isActive ? "Time Remaining" : metrics.isUpcoming ? "Starts In" : "Status"}
                </p>
                <p className="text-lg font-medium text-white">
                  {metrics.isActive
                    ? formatTimeRemaining(metrics.timeRemaining)
                    : metrics.isUpcoming
                    ? formatTimeRemaining(selectedSale.startTs - Math.floor(Date.now() / 1000))
                    : "Ended"}
                </p>
              </div>
            </div>
          </MagicCard>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sale Progress */}
          <div className="lg:col-span-2 space-y-6">
            <MagicCard
              className="p-6 rounded-2xl"
              gradientSize={200}
              gradientFrom="#d4f6d3"
              gradientTo="#0b1418"
            >
              <h3 className="text-lg font-medium text-white mb-6">Sale Progress</h3>

              {/* Token Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Tokens Sold</span>
                  <span className="text-white">
                    {formatTokenBalance(selectedSale.tokensSold, 8)} /{" "}
                    {formatTokenBalance(selectedSale.totalTokens, 8)}
                  </span>
                </div>
                <Progress value={metrics.progress} className="h-3 bg-[#D4F6D3]/10" />
              </div>

              {/* Soft Cap Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Soft Cap</span>
                  <span className="text-white">
                    {formatAptAmount(selectedSale.raisedApt)} / {formatAptAmount(selectedSale.softCap)} APT
                  </span>
                </div>
                <Progress value={metrics.softCapProgress} className="h-3 bg-blue-500/10" />
              </div>

              {/* Sale Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Price per Token</p>
                  <p className="text-white font-medium">{priceToApt(selectedSale.pricePerToken)} APT</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Tokens</p>
                  <p className="text-white font-medium">
                    {formatTokenBalance(selectedSale.totalTokens, 8)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tokens Available</p>
                  <p className="text-white font-medium">
                    {formatTokenBalance(selectedSale.totalTokens - selectedSale.tokensSold, 8)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Start Time</p>
                  <p className="text-white font-medium">
                    {new Date(selectedSale.startTs * 1000).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">End Time</p>
                  <p className="text-white font-medium">
                    {new Date(selectedSale.endTs * 1000).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Token Address</p>
                  <p className="text-white font-mono text-xs truncate">{selectedSale.token}</p>
                </div>
              </div>
            </MagicCard>

            {/* Liquidity Info */}
            <MagicCard
              className="p-6 rounded-2xl"
              gradientSize={200}
              gradientFrom="#d4f6d3"
              gradientTo="#0b1418"
            >
              <div className="flex items-center gap-3 mb-4">
                <Droplets className="h-5 w-5 text-[#D4F6D3]" />
                <h3 className="text-lg font-medium text-white">Liquidity</h3>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                After the sale ends, you can add liquidity to DEXes on Aptos to enable trading.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0B1418] border border-[#D4F6D3]/10">
                  <p className="text-xs text-gray-500 mb-1">Suggested Initial Liquidity</p>
                  <p className="text-white font-medium">
                    {formatAptAmount(selectedSale.raisedApt / BigInt(2))} APT
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0B1418] border border-[#D4F6D3]/10">
                  <p className="text-xs text-gray-500 mb-1">Token Pair</p>
                  <p className="text-white font-medium">{selectedSale.stored?.tokenSymbol || "TOKEN"} / APT</p>
                </div>
              </div>
              {metrics.hasEnded && isOwner && (
                <button className="mt-4 w-full py-3 px-4 bg-[#D4F6D3]/10 text-[#D4F6D3] rounded-xl font-medium hover:bg-[#D4F6D3]/20 transition-colors flex items-center justify-center gap-2">
                  <Droplets className="h-4 w-4" />
                  Add Liquidity on DEX
                </button>
              )}
            </MagicCard>
          </div>

          {/* Buy / Withdraw Panel */}
          <div className="space-y-6">
            {/* Buy Panel */}
            {metrics.isActive && !isOwner && (
              <MagicCard
                className="p-6 rounded-2xl"
                gradientSize={200}
                gradientFrom="#d4f6d3"
                gradientTo="#0b1418"
              >
                <h3 className="text-lg font-medium text-white mb-4">Buy Tokens</h3>

                <div className="space-y-4">
                  {/* Amount Input */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Amount (APT)</label>
                    <input
                      type="number"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                      placeholder="0.0"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                    />
                  </div>

                  {/* You'll Receive */}
                  {buyAmount && parseFloat(buyAmount) > 0 && (
                    <div className="p-4 rounded-xl bg-[#0B1418] border border-[#D4F6D3]/10">
                      <p className="text-xs text-gray-500 mb-1">You&apos;ll Receive</p>
                      <p className="text-xl font-medium text-[#D4F6D3]">
                        {formatTokenBalance(tokensForApt, 8)} {selectedSale.stored?.tokenSymbol || "Tokens"}
                      </p>
                    </div>
                  )}

                  {/* Vesting Period */}
                  <div>
                    <DefiTooltip term="vestingPeriod">
                      <label className="block text-sm text-gray-400 mb-2">Vesting Period</label>
                    </DefiTooltip>
                    <Select value={vestingDays} onValueChange={setVestingDays}>
                      <SelectTrigger className="w-full bg-[#0B1418] border-[#D4F6D3]/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0B1418] border-[#D4F6D3]/20">
                        <SelectItem value="7">7 Days</SelectItem>
                        <SelectItem value="14">14 Days</SelectItem>
                        <SelectItem value="30">30 Days</SelectItem>
                        <SelectItem value="60">60 Days</SelectItem>
                        <SelectItem value="90">90 Days</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-2">
                      Tokens will vest <DefiTooltip term="linearVesting" showIcon={false}><span className="border-b border-dotted border-gray-500">linearly</span></DefiTooltip> over this period
                    </p>
                  </div>

                  <button
                    onClick={handleBuyTokens}
                    disabled={isBuying || !connected || !buyAmount}
                    className="w-full py-4 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isBuying ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-5 w-5" />
                        Buy Tokens
                      </>
                    )}
                  </button>
                </div>
              </MagicCard>
            )}

            {/* Owner Panel */}
            {isOwner && (
              <MagicCard
                className="p-6 rounded-2xl"
                gradientSize={200}
                gradientFrom="#d4f6d3"
                gradientTo="#0b1418"
              >
                <h3 className="text-lg font-medium text-white mb-4">Sale Management</h3>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#0B1418] border border-[#D4F6D3]/10">
                    <p className="text-xs text-gray-500 mb-1">Proceeds Available</p>
                    <p className="text-xl font-medium text-[#D4F6D3]">
                      {formatAptAmount(selectedSale.raisedApt)} APT
                    </p>
                  </div>

                  {metrics.hasEnded && selectedSale.raisedApt > BigInt(0) && (
                    <button
                      onClick={handleWithdrawProceeds}
                      disabled={isBuying}
                      className="w-full py-4 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isBuying ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Wallet className="h-5 w-5" />
                          Withdraw Proceeds
                        </>
                      )}
                    </button>
                  )}

                  {!metrics.hasEnded && (
                    <p className="text-sm text-gray-400 text-center">
                      Proceeds can be withdrawn after the sale ends
                    </p>
                  )}
                </div>
              </MagicCard>
            )}

            {/* Not Connected */}
            {!connected && metrics.isActive && (
              <MagicCard
                className="p-6 rounded-2xl text-center"
                gradientSize={200}
                gradientFrom="#d4f6d3"
                gradientTo="#0b1418"
              >
                <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">Connect your wallet to participate</p>
              </MagicCard>
            )}

            {/* Sale Info */}
            <MagicCard
              className="p-6 rounded-2xl"
              gradientSize={200}
              gradientFrom="#d4f6d3"
              gradientTo="#0b1418"
            >
              <h3 className="text-lg font-medium text-white mb-4">Sale Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Shield className="h-4 w-4" />
                  <DefiTooltip term="escrow" showIcon={false}>
                    <span className="border-b border-dotted border-gray-500/50">Tokens escrowed</span>
                  </DefiTooltip>
                  <span> in smart contract</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Activity className="h-4 w-4" />
                  <DefiTooltip term="linearVesting" showIcon={false}>
                    <span className="border-b border-dotted border-gray-500/50">Linear vesting</span>
                  </DefiTooltip>
                  <span> for all purchases</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <DefiTooltip term="fairLaunch" showIcon={false}>
                    <span className="border-b border-dotted border-gray-500/50">Fair launch</span>
                  </DefiTooltip>
                  <span> - no pre-allocations</span>
                </div>
              </div>
            </MagicCard>
          </div>
        </div>

        {/* Transaction Result */}
        {txResult && (
          <div
            className={`p-4 rounded-xl border ${
              txResult.success
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            <p className="text-sm break-all">{txResult.message}</p>
          </div>
        )}
      </div>
    );
  };

  // Render create form
  const renderCreateForm = () => {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => {
            if (createStep === "project") {
              setShowCreateForm(false);
            } else if (createStep === "token") {
              setCreateStep("project");
            } else if (createStep === "details") {
              setCreateStep("token");
            } else {
              setCreateStep("details");
            }
          }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {createStep === "project" ? "Back to Sales" : "Back"}
        </button>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {["project", "token", "details", "review"].map((step, index) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  createStep === step
                    ? "bg-[#D4F6D3] text-[#0B1418]"
                    : ["project", "token", "details", "review"].indexOf(createStep) > index
                    ? "bg-[#D4F6D3]/20 text-[#D4F6D3]"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {index + 1}
              </div>
              {index < 3 && (
                <div
                  className={`w-12 h-0.5 ${
                    ["project", "token", "details", "review"].indexOf(createStep) > index
                      ? "bg-[#D4F6D3]"
                      : "bg-gray-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Project Selection */}
        {createStep === "project" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-light text-white text-center">Select Project</h2>

            {/* Show loading state while fetching projects */}
            {isLoadingProjects ? (
              <MagicCard
                className="p-8 rounded-2xl text-center"
                gradientSize={200}
                gradientFrom="#d4f6d3"
                gradientTo="#0b1418"
              >
                <Loader2 className="h-10 w-10 text-[#D4F6D3] animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading your projects...</p>
              </MagicCard>
            ) : projects.length > 0 ? (
              /* Show dropdown if projects exist */
              <MagicCard
                className="p-6 rounded-2xl"
                gradientSize={200}
                gradientFrom="#d4f6d3"
                gradientTo="#0b1418"
              >
                <h3 className="text-lg font-medium text-white mb-4">Select a Project</h3>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
                  <SelectTrigger className="w-full bg-[#0B1418] border-[#D4F6D3]/20 text-white">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0B1418] border-[#D4F6D3]/20">
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-3">
                  These are projects you&apos;ve created from your wallet
                </p>
              </MagicCard>
            ) : (
              /* Show empty state if no projects */
              <MagicCard
                className="p-8 rounded-2xl text-center"
                gradientSize={200}
                gradientFrom="#d4f6d3"
                gradientTo="#0b1418"
              >
                <Rocket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Projects Found</h3>
                <p className="text-gray-400 text-sm mb-6">
                  You need to create a project first before launching a token sale
                </p>
                <a
                  href="/create-project"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  Create a Project First
                </a>
              </MagicCard>
            )}

            {projects.length > 0 && !isLoadingProjects && (
              <div className="flex justify-end">
                <button
                  onClick={() => setCreateStep("token")}
                  disabled={!selectedProjectId}
                  className="px-8 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Token Selection */}
        {createStep === "token" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-light text-white text-center">Select Token</h2>

            <MagicCard
              className="p-6 rounded-2xl"
              gradientSize={200}
              gradientFrom="#d4f6d3"
              gradientTo="#0b1418"
            >
              <label className="block text-sm text-gray-400 mb-3">Token for Sale</label>
              <Select
                value={saleFormData.tokenMetadata}
                onValueChange={(v) => setSaleFormData({ ...saleFormData, tokenMetadata: v })}
              >
                <SelectTrigger className="w-full bg-[#0B1418] border-[#D4F6D3]/20 text-white">
                  <SelectValue placeholder="Select a token from your wallet" />
                </SelectTrigger>
                <SelectContent className="bg-[#0B1418] border-[#D4F6D3]/20">
                  {walletTokens.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No tokens found in wallet
                    </SelectItem>
                  ) : (
                    walletTokens.map((token) => (
                      <SelectItem key={token.metadata} value={token.metadata}>
                        {token.symbol} - {formatTokenBalance(token.balance, token.decimals)} available
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {selectedToken && (
                <div className="mt-4 p-4 rounded-xl bg-[#0B1418] border border-[#D4F6D3]/10">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Token Name</p>
                      <p className="text-white">{selectedToken.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Symbol</p>
                      <p className="text-white">{selectedToken.symbol}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Decimals</p>
                      <p className="text-white">{selectedToken.decimals}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Balance</p>
                      <p className="text-white">
                        {formatTokenBalance(selectedToken.balance, selectedToken.decimals)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </MagicCard>

            <div className="flex justify-between">
              <button
                onClick={() => setCreateStep("project")}
                className="px-8 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setCreateStep("details")}
                disabled={!saleFormData.tokenMetadata}
                className="px-8 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Sale Details */}
        {createStep === "details" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex-1" />
              <h2 className="text-2xl font-light text-white text-center">Sale Details</h2>
              <div className="flex-1 flex justify-end">
                <button
                  type="button"
                  onClick={fillDemoSaleDetails}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#0B1418] border border-[#D4F6D3]/30 text-[#D4F6D3] rounded-lg text-sm hover:bg-[#D4F6D3]/10 hover:border-[#D4F6D3]/50 transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Demo Fill
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Total Tokens */}
              <MagicCard
                className="p-6 rounded-2xl"
                gradientSize={200}
                gradientFrom="#d4f6d3"
                gradientTo="#0b1418"
              >
                <label className="block text-sm text-gray-400 mb-2">Total Tokens for Sale *</label>
                <input
                  type="text"
                  value={saleFormData.totalTokens}
                  onChange={(e) => setSaleFormData({ ...saleFormData, totalTokens: e.target.value })}
                  placeholder="1000000"
                  className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                />
                {selectedToken && (
                  <p className="text-xs text-gray-500 mt-2">
                    Max: {formatTokenBalance(selectedToken.balance, selectedToken.decimals)}
                  </p>
                )}
              </MagicCard>

              {/* Price Per Token */}
              <MagicCard
                className="p-6 rounded-2xl"
                gradientSize={200}
                gradientFrom="#d4f6d3"
                gradientTo="#0b1418"
              >
                <label className="block text-sm text-gray-400 mb-2">Price per Token (APT) *</label>
                <input
                  type="text"
                  value={saleFormData.pricePerToken}
                  onChange={(e) => setSaleFormData({ ...saleFormData, pricePerToken: e.target.value })}
                  placeholder="0.001"
                  className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                />
                <p className="text-xs text-gray-500 mt-2">APT per token</p>
              </MagicCard>

              {/* Start Date */}
              <MagicCard
                className="p-6 rounded-2xl"
                gradientSize={200}
                gradientFrom="#d4f6d3"
                gradientTo="#0b1418"
              >
                <label className="block text-sm text-gray-400 mb-2">Start Date *</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white text-left flex items-center justify-between hover:border-[#D4F6D3]/50 transition-all">
                      {saleFormData.startDate ? (
                        format(saleFormData.startDate, "PPP")
                      ) : (
                        <span className="text-gray-500">Pick a date</span>
                      )}
                      <CalendarIcon className="h-4 w-4 text-gray-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-[#0B1418] border-[#D4F6D3]/20">
                    <Calendar
                      mode="single"
                      selected={saleFormData.startDate || undefined}
                      onSelect={(date) => setSaleFormData({ ...saleFormData, startDate: date || null })}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
                <input
                  type="time"
                  value={saleFormData.startTime}
                  onChange={(e) => setSaleFormData({ ...saleFormData, startTime: e.target.value })}
                  className="w-full mt-2 px-4 py-2 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                />
              </MagicCard>

              {/* End Date */}
              <MagicCard
                className="p-6 rounded-2xl"
                gradientSize={200}
                gradientFrom="#d4f6d3"
                gradientTo="#0b1418"
              >
                <label className="block text-sm text-gray-400 mb-2">End Date *</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white text-left flex items-center justify-between hover:border-[#D4F6D3]/50 transition-all">
                      {saleFormData.endDate ? (
                        format(saleFormData.endDate, "PPP")
                      ) : (
                        <span className="text-gray-500">Pick a date</span>
                      )}
                      <CalendarIcon className="h-4 w-4 text-gray-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-[#0B1418] border-[#D4F6D3]/20">
                    <Calendar
                      mode="single"
                      selected={saleFormData.endDate || undefined}
                      onSelect={(date) => setSaleFormData({ ...saleFormData, endDate: date || null })}
                      disabled={(date) =>
                        date < new Date() || (saleFormData.startDate ? date < saleFormData.startDate : false)
                      }
                    />
                  </PopoverContent>
                </Popover>
                <input
                  type="time"
                  value={saleFormData.endTime}
                  onChange={(e) => setSaleFormData({ ...saleFormData, endTime: e.target.value })}
                  className="w-full mt-2 px-4 py-2 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                />
              </MagicCard>
            </div>

            {/* Soft Cap */}
            <MagicCard
              className="p-6 rounded-2xl"
              gradientSize={200}
              gradientFrom="#d4f6d3"
              gradientTo="#0b1418"
            >
              <label className="block text-sm text-gray-400 mb-2">Soft Cap (APT) *</label>
              <input
                type="text"
                value={saleFormData.softCap}
                onChange={(e) => setSaleFormData({ ...saleFormData, softCap: e.target.value })}
                placeholder="100"
                className="w-full px-4 py-3 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
              />
              <p className="text-xs text-gray-500 mt-2">
                Minimum APT to raise for sale to be considered successful
              </p>
            </MagicCard>

            <div className="flex justify-between">
              <button
                onClick={() => setCreateStep("token")}
                className="px-8 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setCreateStep("review")}
                disabled={
                  !saleFormData.totalTokens ||
                  !saleFormData.pricePerToken ||
                  !saleFormData.startDate ||
                  !saleFormData.endDate ||
                  !saleFormData.softCap
                }
                className="px-8 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Review
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {createStep === "review" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-light text-white text-center">Review & Launch</h2>

            <MagicCard
              className="p-6 rounded-2xl"
              gradientSize={200}
              gradientFrom="#d4f6d3"
              gradientTo="#0b1418"
            >
              <h3 className="text-lg font-medium text-white mb-6">Launch Summary</h3>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Project</p>
                  <p className="text-white">
                    {projects.find((p) => p.id === selectedProjectId)?.name || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Token</p>
                  <p className="text-white">{selectedToken?.symbol || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Tokens</p>
                  <p className="text-white">{saleFormData.totalTokens}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Price per Token</p>
                  <p className="text-white">{saleFormData.pricePerToken} APT</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Start</p>
                  <p className="text-white">
                    {saleFormData.startDate &&
                      format(saleFormData.startDate, "PPP")} at {saleFormData.startTime}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">End</p>
                  <p className="text-white">
                    {saleFormData.endDate &&
                      format(saleFormData.endDate, "PPP")} at {saleFormData.endTime}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Soft Cap</p>
                  <p className="text-white">{saleFormData.softCap} APT</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Max Raise</p>
                  <p className="text-white">
                    {(
                      parseFloat(saleFormData.totalTokens || "0") *
                      parseFloat(saleFormData.pricePerToken || "0")
                    ).toFixed(2)}{" "}
                    APT
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-400 font-medium text-sm">Important</p>
                    <p className="text-yellow-400/80 text-xs mt-1">
                      Your tokens will be deposited to the contract escrow. You&apos;ll receive APT
                      proceeds after the sale ends.
                    </p>
                  </div>
                </div>
              </div>
            </MagicCard>

            {txResult && (
              <div
                className={`p-4 rounded-xl border ${
                  txResult.success
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}
              >
                <p className="text-sm break-all">{txResult.message}</p>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setCreateStep("details")}
                className="px-8 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateSale}
                disabled={isSubmitting || !connected}
                className="px-10 py-4 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-semibold hover:bg-[#c2e8c1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating Launch...
                  </>
                ) : (
                  <>
                    <Rocket className="h-5 w-5" />
                    Launch Fair Sale
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
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

            <section className="px-4 max-w-6xl mx-auto pb-24">
              {/* Header */}
              {!selectedSale && !showCreateForm && (
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h1 className="text-4xl font-light text-white">Fair Launch</h1>
                    <p className="text-gray-400 mt-2">
                      Discover and participate in fair token launches
                    </p>
                  </div>
                  {connected && (
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                    >
                      <Plus className="h-5 w-5" />
                      Create Launch
                    </button>
                  )}
                </div>
              )}

              {/* Analytics Overview */}
              {!selectedSale && !showCreateForm && (
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
                        <p className="text-xs text-gray-500">Total Launches</p>
                        <p className="text-lg font-medium text-white">{analytics.totalSales}</p>
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
                        <Activity className="h-5 w-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Active Now</p>
                        <p className="text-lg font-medium text-white">{analytics.activeSales}</p>
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
                        <Coins className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Raised</p>
                        <p className="text-lg font-medium text-white">
                          {formatAptAmount(analytics.totalRaised)} APT
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
                        <TrendingUp className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Tokens Distributed</p>
                        <p className="text-lg font-medium text-white">
                          {formatTokenBalance(analytics.totalTokensSold, 8)}
                        </p>
                      </div>
                    </div>
                  </MagicCard>
                </div>
              )}

              {/* Main Content */}
              {selectedSale ? (
                renderSaleDetail()
              ) : showCreateForm ? (
                renderCreateForm()
              ) : (
                <>
                  {/* Tabs */}
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
                    <TabsList className="bg-[#0B1418] border border-[#D4F6D3]/20 p-1">
                      <TabsTrigger
                        value="explore"
                        className="data-[state=active]:bg-[#D4F6D3] data-[state=active]:text-[#0B1418] text-gray-400"
                      >
                        All Launches
                      </TabsTrigger>
                      <TabsTrigger
                        value="active"
                        className="data-[state=active]:bg-[#D4F6D3] data-[state=active]:text-[#0B1418] text-gray-400"
                      >
                        Active
                      </TabsTrigger>
                      <TabsTrigger
                        value="upcoming"
                        className="data-[state=active]:bg-[#D4F6D3] data-[state=active]:text-[#0B1418] text-gray-400"
                      >
                        Upcoming
                      </TabsTrigger>
                      <TabsTrigger
                        value="ended"
                        className="data-[state=active]:bg-[#D4F6D3] data-[state=active]:text-[#0B1418] text-gray-400"
                      >
                        Ended
                      </TabsTrigger>
                      {connected && (
                        <TabsTrigger
                          value="my-launches"
                          className="data-[state=active]:bg-[#D4F6D3] data-[state=active]:text-[#0B1418] text-gray-400"
                        >
                          My Launches
                        </TabsTrigger>
                      )}
                    </TabsList>
                  </Tabs>

                  {/* Sales Grid */}
                  {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-[#D4F6D3]" />
                    </div>
                  ) : filteredSales.length === 0 ? (
                    <MagicCard
                      className="p-12 rounded-2xl text-center"
                      gradientSize={300}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <Rocket className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                      <h2 className="text-2xl font-light text-white mb-3">
                        {activeTab === "my-launches"
                          ? "No Launches Yet"
                          : "No Launches Found"}
                      </h2>
                      <p className="text-gray-400 mb-6">
                        {activeTab === "my-launches"
                          ? "Create your first fair launch to get started"
                          : "Check back later for new token launches"}
                      </p>
                      {connected && activeTab === "my-launches" && (
                        <button
                          onClick={() => setShowCreateForm(true)}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                        >
                          <Plus className="h-5 w-5" />
                          Create Your First Launch
                        </button>
                      )}
                    </MagicCard>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredSales.map(renderSaleCard)}
                    </div>
                  )}
                </>
              )}

              {/* Success Modal with Share to X option for Fair Launch creation */}
              {showLaunchSuccessModal && createdSaleInfo && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                  <MagicCard
                    className="p-8 rounded-2xl max-w-md w-full text-center"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#D4F6D3]/20 flex items-center justify-center">
                      <Rocket className="h-8 w-8 text-[#D4F6D3]" />
                    </div>
                    <h3 className="text-2xl font-light text-white mb-3">
                      Fair Launch Created!
                    </h3>
                    <p className="text-gray-400 mb-2">
                      Your fair launch for &quot;{createdSaleInfo.projectName}&quot; (${createdSaleInfo.tokenSymbol}) is now live!
                    </p>
                    <p className="text-sm text-gray-500 mb-8">
                      Sale ID: #{createdSaleInfo.saleId}
                    </p>
                    <div className="space-y-3">
                      <button
                        onClick={handleShareLaunchToX}
                        className="w-full py-3 px-6 bg-black text-white rounded-xl font-medium hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 border border-gray-700"
                      >
                        <Twitter className="h-5 w-5" />
                        Share on X
                      </button>
                      <button
                        onClick={handleCloseLaunchSuccessModal}
                        className="w-full py-3 px-6 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                      >
                        View Launches
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

"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";
import { MagicCard } from "@/components/ui/magic-card";
import {
  Vault,
  Loader2,
  ExternalLink,
  ArrowDown,
  TrendingUp,
  Wallet,
  Info,
} from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { NETWORK as WALLET_NETWORK } from "@/constants";

const poppins = Poppins({ weight: ["200", "300", "400", "700"], subsets: ["latin"] });

// Amnis Finance contract addresses
const AMNIS_ADDRESSES = {
  mainnet: {
    module: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a",
    stAPT: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt",
    amAPT: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt",
  },
  testnet: {
    module: "0xb8188ed9a1b56a11344aab853f708ead152484081c3b5ec081c38646500c42d7",
    stAPT: "0xb8188ed9a1b56a11344aab853f708ead152484081c3b5ec081c38646500c42d7::stapt_token::StakedApt",
    amAPT: "0xb8188ed9a1b56a11344aab853f708ead152484081c3b5ec081c38646500c42d7::amapt_token::AmnisApt",
  },
};

// Create Aptos clients for each network
const mainnetConfig = new AptosConfig({ network: Network.MAINNET });
const testnetConfig = new AptosConfig({ network: Network.TESTNET });
const mainnetAptos = new Aptos(mainnetConfig);
const testnetAptos = new Aptos(testnetConfig);

type VaultNetwork = "mainnet" | "testnet";

export default function VaultPage() {
  const { account, signAndSubmitTransaction, connected } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; message: string } | null>(null);
  const [aptBalance, setAptBalance] = useState<string>("0");
  const [stAptBalance, setStAptBalance] = useState<string>("0");
  const [stakeAmount, setStakeAmount] = useState("");
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<VaultNetwork>(
    WALLET_NETWORK === "mainnet" ? "mainnet" : "testnet"
  );

  // Get the appropriate Aptos client and addresses based on selected network
  const aptos = useMemo(() =>
    selectedNetwork === "mainnet" ? mainnetAptos : testnetAptos,
    [selectedNetwork]
  );

  const amnisAddr = useMemo(() =>
    AMNIS_ADDRESSES[selectedNetwork],
    [selectedNetwork]
  );

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!connected || !account?.address) {
        setAptBalance("0");
        setStAptBalance("0");
        return;
      }

      setLoadingBalances(true);
      try {
        const address = account.address.toString();

        // Fetch APT balance using getAccountCoinAmount
        try {
          const aptAmount = await aptos.getAccountCoinAmount({
            accountAddress: address,
            coinType: "0x1::aptos_coin::AptosCoin",
          });
          setAptBalance((Number(aptAmount) / 1e8).toFixed(4));
        } catch (e) {
          console.error("Failed to fetch APT balance:", e);
          setAptBalance("0");
        }

        // Fetch stAPT balance using getAccountCoinAmount
        try {
          const stAptAmount = await aptos.getAccountCoinAmount({
            accountAddress: address,
            coinType: amnisAddr.stAPT as `${string}::${string}::${string}`,
          });
          setStAptBalance((Number(stAptAmount) / 1e8).toFixed(4));
        } catch (e) {
          // User might not have registered the stAPT coin yet
          console.log("stAPT balance not found (user may not have this coin registered):", e);
          setStAptBalance("0");
        }
      } catch (error) {
        console.error("Failed to fetch balances:", error);
        setAptBalance("0");
        setStAptBalance("0");
      } finally {
        setLoadingBalances(false);
      }
    };

    fetchBalances();
  }, [connected, account?.address, aptos, amnisAddr]);

  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected || !account) {
      setTxResult({ success: false, message: "Please connect your wallet first" });
      return;
    }

    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      setTxResult({ success: false, message: "Please enter a valid amount" });
      return;
    }

    if (parseFloat(stakeAmount) > parseFloat(aptBalance)) {
      setTxResult({ success: false, message: "Insufficient APT balance" });
      return;
    }

    setIsSubmitting(true);
    setTxResult(null);

    try {
      const amountInOctas = Math.floor(parseFloat(stakeAmount) * 1e8);

      // Use the wallet's network addresses for the transaction (not the selected display network)
      const walletAmnisAddr = AMNIS_ADDRESSES[WALLET_NETWORK === "mainnet" ? "mainnet" : "testnet"];
      const walletAptos = WALLET_NETWORK === "mainnet" ? mainnetAptos : testnetAptos;

      // Amnis stake function - deposits APT and mints stAPT
      // deposit_and_stake_entry takes: (signer, amount: u64, referrer: address)
      const payload = {
        function: `${walletAmnisAddr.module}::router::deposit_and_stake_entry` as `${string}::${string}::${string}`,
        typeArguments: [],
        functionArguments: [amountInOctas.toString(), account.address.toString()],
      };

      const response = await signAndSubmitTransaction({ data: payload });
      await walletAptos.waitForTransaction({ transactionHash: response.hash });

      setTxResult({
        success: true,
        message: `Successfully staked ${stakeAmount} APT on ${WALLET_NETWORK}! View transaction: https://explorer.aptoslabs.com/txn/${response.hash}?network=${WALLET_NETWORK}`,
      });
      setStakeAmount("");

      // Refresh balances
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: unknown) {
      console.error("Stake error:", error);
      setTxResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to stake APT",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden bg-[url('/image/bg.png')] bg-cover ${poppins.className}`}>
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar>
          <main className="flex-1 overflow-auto p-4">
            <SidebarTrigger className="mb-4" />
            <section className="px-4 max-w-4xl mx-auto pb-24">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-4xl font-light text-white flex items-center gap-3">
                    <Vault className="h-10 w-10 text-[#D4F6D3]" />
                    Vault
                  </h1>
                  <p className="text-gray-400 mt-2">
                    Stake APT with Amnis Finance to earn staking rewards
                  </p>
                </div>
                {/* Network Selector */}
                <div className="flex items-center gap-2 p-1 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl">
                  <button
                    onClick={() => setSelectedNetwork("mainnet")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedNetwork === "mainnet"
                        ? "bg-[#D4F6D3] text-[#0B1418]"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Mainnet
                  </button>
                  <button
                    onClick={() => setSelectedNetwork("testnet")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedNetwork === "testnet"
                        ? "bg-[#D4F6D3] text-[#0B1418]"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Testnet
                  </button>
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

              {!connected ? (
                /* Connect Wallet Prompt */
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
                    Connect your wallet to stake APT and earn rewards
                  </p>
                </MagicCard>
              ) : (
                <div className="space-y-6">
                  {/* Network Mismatch Warning */}
                  {selectedNetwork !== WALLET_NETWORK && (
                    <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-400">
                          <p className="font-medium mb-1">Network Mismatch</p>
                          <p className="text-yellow-400/80">
                            Your wallet is connected to <span className="font-medium">{WALLET_NETWORK}</span>, but you're viewing <span className="font-medium">{selectedNetwork}</span> balances.
                            Transactions will be submitted on <span className="font-medium">{WALLET_NETWORK}</span>.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Network Indicator */}
                  <div className="mb-4 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${selectedNetwork === "mainnet" ? "bg-green-400" : "bg-yellow-400"}`} />
                    <span className="text-sm text-gray-400">
                      Viewing <span className="text-white font-medium capitalize">{selectedNetwork}</span> balances
                    </span>
                  </div>

                  {/* Balance Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MagicCard
                      className="p-6 rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Image
                            src="/image/amAPT.png"
                            alt="APT"
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                          <span className="text-gray-400 text-sm">APT Balance</span>
                        </div>
                        {loadingBalances && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                      </div>
                      <p className="text-3xl font-light text-white">
                        {aptBalance} <span className="text-lg text-gray-400">APT</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-2 capitalize">{selectedNetwork}</p>
                    </MagicCard>

                    <MagicCard
                      className="p-6 rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Image
                            src="/image/stAPT.png"
                            alt="stAPT"
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                          <span className="text-gray-400 text-sm">stAPT Balance</span>
                        </div>
                        <TrendingUp className="h-4 w-4 text-green-400" />
                      </div>
                      <p className="text-3xl font-light text-white">
                        {stAptBalance} <span className="text-lg text-gray-400">stAPT</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-2 capitalize">{selectedNetwork}</p>
                    </MagicCard>
                  </div>

                  {/* Stake Form */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={300}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <h2 className="text-xl font-medium text-white mb-6 flex items-center gap-2">
                      <ArrowDown className="h-5 w-5 text-[#D4F6D3]" />
                      Stake APT
                    </h2>

                    <form onSubmit={handleStake} className="space-y-6">
                      {/* Amount Input */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-400">
                            Amount to Stake
                          </label>
                          <span className="text-xs text-gray-500">
                            Available: {aptBalance} APT
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            value={stakeAmount}
                            onChange={(e) => setStakeAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-4 py-4 pr-32 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-xl text-white text-xl placeholder-gray-500 focus:outline-none focus:border-[#D4F6D3]/50 transition-all"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setStakeAmount(aptBalance)}
                              className="px-3 py-1 bg-[#D4F6D3]/20 text-[#D4F6D3] rounded-lg text-xs font-medium hover:bg-[#D4F6D3]/30 transition-colors"
                            >
                              MAX
                            </button>
                            <div className="flex items-center gap-1.5">
                              <Image
                                src="/image/amAPT.png"
                                alt="APT"
                                width={20}
                                height={20}
                                className="rounded-full"
                              />
                              <span className="text-gray-400 font-medium">APT</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Info Box */}
                      <div className="p-4 bg-[#D4F6D3]/5 border border-[#D4F6D3]/20 rounded-xl">
                        <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 text-[#D4F6D3] flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-gray-400">
                            <p className="mb-2 flex items-center gap-2">
                              Stake APT to receive
                              <span className="inline-flex items-center gap-1">
                                <Image src="/image/stAPT.png" alt="stAPT" width={16} height={16} className="rounded-full" />
                                <span className="text-white font-medium">stAPT</span>
                              </span>, a liquid staking token that earns staking rewards automatically.
                            </p>
                            <p>
                              stAPT can be used in DeFi while your APT earns rewards.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={isSubmitting || !stakeAmount || parseFloat(stakeAmount) <= 0}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-semibold hover:bg-[#c2e8c1] transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#D4F6D3]/20"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-6 w-6 animate-spin" />
                            Staking...
                          </>
                        ) : (
                          <>
                            <Vault className="h-6 w-6" />
                            Stake APT
                          </>
                        )}
                      </button>
                    </form>
                  </MagicCard>

                  {/* Amnis Info */}
                  <MagicCard
                    className="p-6 rounded-2xl"
                    gradientSize={200}
                    gradientFrom="#d4f6d3"
                    gradientTo="#0b1418"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Image
                          src="/Amnis brading guideline_Logo - white.svg"
                          alt="Amnis Finance"
                          width={48}
                          height={48}
                          className="rounded-lg"
                        />
                        <div>
                          <h3 className="text-lg font-medium text-white mb-1">Powered by Amnis Finance</h3>
                          <p className="text-sm text-gray-400">
                            Liquid staking protocol on Aptos
                          </p>
                        </div>
                      </div>
                      <a
                        href="https://amnis.finance"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#0B1418] border border-[#D4F6D3]/20 rounded-lg text-[#D4F6D3] hover:border-[#D4F6D3]/50 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Learn More
                      </a>
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

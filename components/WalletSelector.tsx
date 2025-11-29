"use client";

import { Button } from "@/components/ui/button";
import {
  useWallet,
  groupAndSortWallets,
  isInstallRequired,
  truncateAddress,
  type AdapterWallet,
  type AdapterNotDetectedWallet,
} from "@aptos-labs/wallet-adapter-react";
import { Copy, LogOut, ChevronDown, X } from "lucide-react";
import { useCallback, useState, useRef, useEffect } from "react";

export function WalletSelector() {
  const { account, connected, disconnect, connect } = useWallet();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeDialog = useCallback(() => setIsDialogOpen(false), []);

  const copyAddress = useCallback(async () => {
    if (!account?.address) return;
    try {
      await navigator.clipboard.writeText(account.address.toString());
      setIsDropdownOpen(false);
    } catch {
      console.error("Failed to copy address");
    }
  }, [account?.address]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setIsDropdownOpen(false);
  }, [disconnect]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (connected) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
        >
          {truncateAddress(account?.address?.toString()) || "Connected"}
          <ChevronDown className="h-4 w-4" />
        </button>
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-md border border-white/10 bg-black/90 backdrop-blur-sm shadow-lg z-50">
            <button
              onClick={copyAddress}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-white/10 transition-colors"
            >
              <Copy className="h-4 w-4" /> Copy address
            </button>
            <button
              onClick={handleDisconnect}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-white/10 transition-colors text-red-400"
            >
              <LogOut className="h-4 w-4" /> Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setIsDialogOpen(true)} className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors">Connect Wallet</button>
      {isDialogOpen && (
        <ConnectWalletDialog close={closeDialog} connect={connect} />
      )}
    </>
  );
}

interface ConnectWalletDialogProps {
  close: () => void;
  connect: (walletName: string) => void;
}

function ConnectWalletDialog({ close, connect }: ConnectWalletDialogProps) {
  const { wallets = [], notDetectedWallets = [] } = useWallet();
  const { aptosConnectWallets, availableWallets, installableWallets } =
    groupAndSortWallets([...wallets, ...notDetectedWallets]);

  const handleConnect = async (walletName: string) => {
    try {
      await connect(walletName);
      close();
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
      />
      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Connect Wallet</h2>
          <button
            onClick={close}
            className="rounded-full p-1 hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
          {/* Aptos Connect Wallets (Social Login) */}
          {aptosConnectWallets.length > 0 && (
            <>
              <p className="text-sm text-white/60 mb-2">Social Login</p>
              {aptosConnectWallets.map((wallet) => (
                <WalletRow
                  key={wallet.name}
                  wallet={wallet}
                  onConnect={() => handleConnect(wallet.name)}
                />
              ))}
              <div className="flex items-center gap-3 py-3 text-white/40">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-sm">Or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
            </>
          )}

          {/* Available/Installed Wallets */}
          {availableWallets.length > 0 && (
            <>
              <p className="text-sm text-white/60 mb-2">Available Wallets</p>
              {availableWallets.map((wallet) => (
                <WalletRow
                  key={wallet.name}
                  wallet={wallet}
                  onConnect={() => handleConnect(wallet.name)}
                />
              ))}
            </>
          )}

          {/* Installable Wallets */}
          {installableWallets.length > 0 && (
            <>
              <p className="text-sm text-white/60 mt-4 mb-2">More Wallets</p>
              {installableWallets.map((wallet) => (
                <WalletRow
                  key={wallet.name}
                  wallet={wallet}
                  onConnect={() => handleConnect(wallet.name)}
                />
              ))}
            </>
          )}

          {/* No wallets available */}
          {availableWallets.length === 0 &&
            installableWallets.length === 0 &&
            aptosConnectWallets.length === 0 && (
              <p className="text-center text-white/60 py-4">
                No wallets detected. Please install a wallet extension.
              </p>
            )}
        </div>
      </div>
    </div>
  );
}

interface WalletRowProps {
  wallet: AdapterWallet | AdapterNotDetectedWallet;
  onConnect: () => void;
}

function WalletRow({ wallet, onConnect }: WalletRowProps) {
  const needsInstall = isInstallRequired(wallet);

  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4 border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-3">
        {wallet.icon && (
          <img src={wallet.icon} alt={wallet.name} className="h-8 w-8 rounded-lg" />
        )}
        <span className="font-medium">{wallet.name}</span>
      </div>
      {needsInstall ? (
        <a
          href={wallet.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
        >
          Install
        </a>
      ) : (
        <Button size="sm" onClick={onConnect}>
          Connect
        </Button>
      )}
    </div>
  );
}

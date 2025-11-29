"use client"

import React from 'react'
import { useWallet } from "@aptos-labs/wallet-adapter-react";

const Navbar = () => {
  const { account, connected, wallet, connect, disconnect } = useWallet();

  const handleConnect = async () => {
    if (connected) {
      await disconnect();
    } else {
      // Connect to the first available wallet (Petra)
      await connect("Petra");
    }
  };

  const addressString = account?.address?.toString() || '';

  return (
    <div className='h-20 w-full bg-transparent flex items-center justify-between border-b border-white/10 px-3'>
      <div className='flex items-center gap-3'>
        <img src="/image/lil-logo1.png" alt="Lilipad Logo" className="w-8 h-8" />
        <div className='text-2xl font-bold'>LiliPad</div>
      </div>
      <div className='flex items-center gap-4'>
        <button
          onClick={handleConnect}
          className='px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors'
        >
          {connected && addressString ? `${addressString.slice(0, 6)}...${addressString.slice(-4)}` : 'Connect Wallet'}
        </button>
      </div>
    </div>
  )
}

export default Navbar

"use client"

import React from 'react'
import { WalletSelector } from "@/components/WalletSelector";

const Navbar = () => {
  return (
    <div className='h-20 w-full bg-transparent flex items-center justify-between border-b border-white/10 px-3'>
      <div className='flex items-center gap-3'>
        <img src="/image/lil-logo1.png" alt="Lilipad Logo" className="w-8 h-8" />
        <div className='text-2xl font-medium'>LiliPad</div>
      </div>
      <div className='flex items-center gap-4'>
        <WalletSelector />
      </div>
    </div>
  )
}

export default Navbar

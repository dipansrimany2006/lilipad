"use client"

import { useState, useRef, useEffect } from 'react'
import { WalletSelector } from "@/components/WalletSelector";
import { Search, X, Sparkles } from "lucide-react";
import { DEFI_TERMS } from "@/components/defi-tooltip";

// Popular/suggested terms to show when search is focused
const SUGGESTED_TERMS = ["softCap", "vesting", "liquidity", "apy", "tvl", "slippage"] as const;

const Navbar = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter DeFi terms based on search query
  const filteredTerms = Object.entries(DEFI_TERMS).filter(([key, term]) => {
    if (!searchQuery.trim()) return false;
    const query = searchQuery.toLowerCase();
    return (
      term.title.toLowerCase().includes(query) ||
      term.description.toLowerCase().includes(query) ||
      key.toLowerCase().includes(query)
    );
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClearSearch = () => {
    setSearchQuery("");
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (termKey: string) => {
    const term = DEFI_TERMS[termKey as keyof typeof DEFI_TERMS];
    if (term) {
      setSearchQuery(term.title);
    }
  };

  const handleTermClick = () => {
    setSearchQuery("");
    setIsSearchFocused(false);
  };

  return (
    <div className='h-20 w-full bg-transparent flex items-center justify-between border-b border-white/10 px-4'>
      <div className='flex items-center gap-3'>
        <img src="/image/lil-logo1.png" alt="Lilipad Logo" className="w-8 h-8" />
        <div className='text-2xl font-medium'>LiliPad</div>
      </div>

      <div className='flex items-center gap-3'>
        {/* DeFi Terms Search Bar - matches wallet button style */}
        <div className="relative" ref={searchRef}>
          <div className={`flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-lg transition-colors w-64 ${
            isSearchFocused
              ? 'bg-white/20'
              : 'hover:bg-white/20'
          }`}>
            <Search className={`h-4 w-4 flex-shrink-0 transition-colors ${isSearchFocused ? 'text-white' : 'text-gray-400'}`} />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Search DeFi terms..."
              className="flex-1 bg-transparent text-white placeholder-gray-400 text-sm focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="p-0.5 hover:bg-white/10 rounded transition-colors"
              >
                <X className="h-3.5 w-3.5 text-gray-400 hover:text-white" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {isSearchFocused && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-[#0B1418]/98 backdrop-blur-xl border border-[#D4F6D3]/20 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50">
              {searchQuery.trim() ? (
                // Show search results
                filteredTerms.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
                      <Search className="h-5 w-5 text-gray-500" />
                    </div>
                    <p className="text-gray-400 text-sm">No results for &quot;{searchQuery}&quot;</p>
                    <p className="text-gray-600 text-xs mt-1">Try searching for APY, TVL, or Vesting</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    <div className="px-3 py-2 border-b border-white/5">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">
                        {filteredTerms.length} result{filteredTerms.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {filteredTerms.map(([key, term]) => (
                      <div
                        key={key}
                        className="px-4 py-3 hover:bg-[#D4F6D3]/10 cursor-pointer transition-colors group"
                        onClick={handleTermClick}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[#D4F6D3] font-medium text-sm group-hover:text-[#e5f9e4]">
                            {term.title}
                          </span>
                          <span className="text-[10px] text-gray-600 bg-gray-800/50 px-2 py-0.5 rounded-full">
                            DeFi
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
                          {term.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                // Show suggestions when no query
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-3.5 w-3.5 text-[#D4F6D3]" />
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Popular Terms</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_TERMS.map((termKey) => {
                      const term = DEFI_TERMS[termKey];
                      return (
                        <button
                          key={termKey}
                          onClick={() => handleSuggestionClick(termKey)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-[#D4F6D3]/15 border border-white/10 hover:border-[#D4F6D3]/30 rounded-full text-xs text-gray-300 hover:text-[#D4F6D3] transition-all"
                        >
                          {term.title}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <p className="text-[11px] text-gray-600 text-center">
                      Search {Object.keys(DEFI_TERMS).length} DeFi terms and definitions
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <WalletSelector />
      </div>
    </div>
  )
}

export default Navbar

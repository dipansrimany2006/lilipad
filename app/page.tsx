"use client";

import { useState } from "react";
import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";
import { MagicCard } from "@/components/ui/magic-card";
import { Search, Plus } from "lucide-react";
import Link from "next/link";

const poppins = Poppins({ weight: ["200","300","400", "700"], subsets: ["latin"] });

const dummyProjects = [
  {
    id: 1,
    title: "DeFi Lending Protocol",
    description: "A decentralized lending platform built on Aptos blockchain with automated market making",
    category: "DeFi",
    funding: "$50,000",
    backers: 120,
  },
  {
    id: 2,
    title: "NFT Marketplace",
    description: "Next-generation NFT marketplace with zero gas fees and instant transactions",
    category: "NFT",
    funding: "$35,000",
    backers: 85,
  },
  {
    id: 3,
    title: "DAO Governance Platform",
    description: "Decentralized autonomous organization tools for community-driven decision making",
    category: "DAO",
    funding: "$75,000",
    backers: 200,
  },
  {
    id: 4,
    title: "Cross-Chain Bridge",
    description: "Secure and fast asset transfer between Aptos and other blockchains",
    category: "Infrastructure",
    funding: "$100,000",
    backers: 150,
  },
  {
    id: 5,
    title: "GameFi Platform",
    description: "Play-to-earn gaming ecosystem with integrated token rewards and NFT items",
    category: "Gaming",
    funding: "$60,000",
    backers: 250,
  },
  {
    id: 6,
    title: "Social Impact Fund",
    description: "Blockchain-based crowdfunding for environmental and social causes",
    category: "Social",
    funding: "$42,000",
    backers: 180,
  },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = dummyProjects.filter(
    (project) =>
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden bg-[url('/image/bg.png')] bg-cover ${poppins.className}`}
    >
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar>
          <main className="flex-1 overflow-auto p-4">
            <SidebarTrigger className="mb-4" />
            
            {/* Projects Showcase Section */}
            <section className="pr-4 pb-8">
              <div>
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-4xl font-light text-white">
                    Explore Projects
                  </h2>
                  <Link
                    href="/create-project"
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    Create Project
                  </Link>
                </div>

                {/* Search Bar */}
                <div className="relative mb-8">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 bg-[#0B1418] text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search projects by name, description, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-[#0B1418] backdrop-blur-sm border-1 border-[#D4F6D0] rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0B1418] focus:border-transparent transition-all"
                  />
                </div>

                {/* Projects Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProjects.map((project) => (
                    <MagicCard
                      key={project.id}
                      className="p-6 cursor-pointer h-full rounded-2xl"
                      gradientSize={200}
                      gradientFrom="#d4f6d3"
                      gradientTo="#0b1418"
                    >
                      <div className="flex flex-col h-full space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-medium text-white">
                              {project.title}
                            </h3>
                            <span className="px-3 py-1 bg-[#d4f6d3] text-[#0b1418] rounded-full text-xs font-medium">
                              {project.category}
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            {project.description}
                          </p>
                        </div>

                        <div className="mt-auto pt-4 border-t border-white/10">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-xs text-gray-400">Total Raised</p>
                              <p className="text-lg font-medium text-white">
                                {project.funding}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-400">Backers</p>
                              <p className="text-lg font-medium text-white">
                                {project.backers}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </MagicCard>
                  ))}
                </div>

                {filteredProjects.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-lg">
                      No projects found matching your search.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </main>
        </AppSidebar>
      </div>
    </div>
  );
}
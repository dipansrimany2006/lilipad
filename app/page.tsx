"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";
import { MagicCard } from "@/components/ui/magic-card";
import { Search, Plus, Loader2, Github, Globe, FileText, ExternalLink, Calendar, Coins, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const poppins = Poppins({ weight: ["200","300","400", "700"], subsets: ["latin"] });

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

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        const response = await fetch("/api/projects");
        const data = await response.json();

        if (data.success) {
          setProjects(data.projects);
        } else {
          setError(data.error || "Failed to fetch projects");
        }
      } catch (err) {
        setError("Failed to fetch projects");
        console.error("Error fetching projects:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
                {loading ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-10 w-10 text-[#D4F6D3] animate-spin" />
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <p className="text-red-400 text-lg">{error}</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredProjects.map((project) => (
                        <MagicCard
                          key={project.id}
                          className="p-4 cursor-pointer rounded-2xl"
                          gradientSize={200}
                          gradientFrom="#d4f6d3"
                          gradientTo="#0b1418"
                        >
                          <div className="flex gap-3">
                            {/* Left: Project Image (1:1 ratio) */}
                            <div className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-white/5">
                              {project.image_url ? (
                                <Image
                                  src={project.image_url}
                                  alt={project.name}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-4xl font-bold text-[#d4f6d3]/50">
                                    {project.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Right: Content */}
                            <div className="flex flex-col flex-1 min-w-0">
                              {/* Header: Name & Category */}
                              <div className="mb-1">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="text-lg font-medium text-white truncate">
                                    {project.name}
                                  </h3>
                                  <span className="px-2 py-0.5 bg-[#d4f6d3] text-[#0b1418] rounded-full text-xs font-medium flex-shrink-0">
                                    {project.category}
                                  </span>
                                </div>
                              </div>

                              {/* Description */}
                              <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 mb-2">
                                {project.description}
                              </p>

                              {/* Token & Creator - Compact */}
                              <div className="space-y-1 text-sm mb-2">
                                <div className="flex items-center gap-1.5">
                                  <Coins className="h-4 w-4 text-[#d4f6d3] flex-shrink-0" />
                                  <span className="text-white font-mono truncate">
                                    {project.project_token.length > 12
                                      ? `${project.project_token.slice(0, 6)}...${project.project_token.slice(-4)}`
                                      : project.project_token}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Wallet className="h-4 w-4 text-[#d4f6d3] flex-shrink-0" />
                                  <span className="text-white font-mono">
                                    {project.creator_wallet.slice(0, 6)}...{project.creator_wallet.slice(-4)}
                                  </span>
                                </div>
                              </div>

                              {/* Social Links */}
                              <div className="flex items-center gap-1.5">
                                {project.github_url && (
                                  <a
                                    href={project.github_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Github className="h-4 w-4 text-gray-300" />
                                  </a>
                                )}
                                {project.website_url && (
                                  <a
                                    href={project.website_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Globe className="h-4 w-4 text-gray-300" />
                                  </a>
                                )}
                                {project.docs_url && (
                                  <a
                                    href={project.docs_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FileText className="h-4 w-4 text-gray-300" />
                                  </a>
                                )}
                                {project.x_url && (
                                  <a
                                    href={project.x_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-4 w-4 text-gray-300" />
                                  </a>
                                )}
                                <span className="flex items-center gap-1 ml-2 text-gray-500 text-xs">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {new Date(project.created_at).toLocaleDateString()}
                                </span>
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
                  </>
                )}
              </div>
            </section>
          </main>
        </AppSidebar>
      </div>
    </div>
  );
}
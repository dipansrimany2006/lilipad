"use client";

import { useState } from "react";
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
  ArrowLeft
} from "lucide-react";
import Link from "next/link";

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

export default function CreateProject() {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    image: null as File | null,
    githubUrl: "",
    websiteUrl: "",
    docsUrl: "",
    xUrl: ""
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    // Handle form submission
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

            <section className="px-4 max-w-4xl mx-auto">
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
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
                    className="px-8 py-3 bg-[#D4F6D3] text-[#0B1418] rounded-xl font-medium hover:bg-[#c2e8c1] transition-colors text-lg"
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </section>
          </main>
        </AppSidebar>
      </div>
    </div>
  );
}

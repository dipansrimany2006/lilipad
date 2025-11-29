"use client";

import Navbar from "@/components/navbar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Poppins } from "next/font/google";

const poppins = Poppins({ weight: ["200", "300", "400", "700"], subsets: ["latin"] });

export default function Launch() {
  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden bg-[url('/image/bg.png')] bg-cover ${poppins.className}`}
    >
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar>
          <main className="flex-1 overflow-auto p-4">
            <SidebarTrigger className="mb-4" />
            <div className="text-white">
              <h1 className="text-4xl font-light mb-4">Launch</h1>
            </div>
          </main>
        </AppSidebar>
      </div>
    </div>
  );
}

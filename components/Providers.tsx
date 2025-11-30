"use client";

import dynamic from "next/dynamic";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PropsWithChildren } from "react";

const WalletProvider = dynamic(
  () => import("@/components/WalletProvider").then((mod) => mod.WalletProvider),
  { ssr: false }
);

export function Providers({ children }: PropsWithChildren) {
  return (
    <WalletProvider>
      <TooltipProvider>
        <SidebarProvider>{children}</SidebarProvider>
      </TooltipProvider>
    </WalletProvider>
  );
}

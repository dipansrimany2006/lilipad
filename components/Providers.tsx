"use client";

import dynamic from "next/dynamic";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { PropsWithChildren } from "react";

const WalletProvider = dynamic(
  () => import("@/components/WalletProvider").then((mod) => mod.WalletProvider),
  { ssr: false }
);

export function Providers({ children }: PropsWithChildren) {
  return (
    <WalletProvider>
      <SidebarProvider>{children}</SidebarProvider>
    </WalletProvider>
  );
}

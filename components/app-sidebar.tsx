"use client";
import React, { useState } from "react";
import { Sidebar, SidebarBody } from "@/components/ui/sidebar";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  ChevronRightIcon,
  Rocket,
  Lock,
  Droplets,
  Flower,
  CirclePoundSterling,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { sidebarLinks } from "@/constants";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const getIcon = (iconName: string) => {
  const iconMap = {
    Flower: Flower,
    Rocket: Rocket,
    Lock: Lock,
    Droplets: Droplets,
    CirclePoundSterling: CirclePoundSterling,
  };
  const IconComponent = iconMap[iconName as keyof typeof iconMap];
  return IconComponent ? <IconComponent className="w-5 h-5" /> : null;
};
const getBadge = (listLabel: string) => {
  const listLabelMap: { [key: string]: string } = {
    beta: "bg-yellow-300/20 text-yellow-300",
    "coming soon": "bg-red-500/20 text-red-500/70",
  };
  return listLabelMap[listLabel];
};

interface SidebarLinkItemProps {
  link: any;
  idx: number;
  open: boolean;
  animate: [boolean, React.Dispatch<React.SetStateAction<boolean>>];
  pathname: string;
  expandedItems: number[];
  setExpandedItems: React.Dispatch<React.SetStateAction<number[]>>;
}

function SidebarLinkItem({
  link,
  idx,
  open,
  animate,
  pathname,
  expandedItems,
  setExpandedItems,
}: SidebarLinkItemProps) {
  const isActive = pathname === link.href;
  const isExpanded = expandedItems.includes(idx);
  const hasSublinks = link.sublinks && link.sublinks.length > 0;

  const handleMouseEnter = () => {
    if (hasSublinks && open) {
      setExpandedItems((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
    }
  };

  const handleMouseLeave = () => {
    if (hasSublinks && open) {
      setExpandedItems((prev) => prev.filter((id) => id !== idx));
    }
  };

  if (!hasSublinks) {
    return (
      <Link
        href={link.href}
        className="flex items-center justify-start gap-2 w-full group/sidebar py-2 h-10"
      >
        {link.icon && getIcon(link.icon)}
        <motion.span
          animate={{
            display: animate[0] ? (open ? "flex" : "none") : "inline-block",
            opacity: animate[0] ? (open ? 1 : 0) : 1,
          }}
          className={cn(
            "w-full flex justify-between font-poppins text-lg group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre !p-0 !m-0",
            isActive
              ? "text-white"
              : "text-white/50 group-hover/sidebar:text-white"
          )}
        >
          {link.name}
          {link.label && (
            <Badge
              className={cn(
                "border-transparent",
                getBadge(link.label.toLowerCase())
              )}
            >
              {link.label}
            </Badge>
          )}
        </motion.span>
      </Link>
    );
  }

  return (
    <div
      className="space-y-1"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href={link.href}
        className="flex items-center justify-start gap-2 w-full group/sidebar py-2 h-8"
      >
        {link.icon && getIcon(link.icon)}
        <motion.span
          animate={{
            display: animate[0]
              ? open
                ? "inline-block"
                : "none"
              : "inline-block",
            opacity: animate[0] ? (open ? 1 : 0) : 1,
          }}
          className={cn(
            "flex items-center gap-2 font-poppins text-lg group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre !p-0 !m-0",
            isActive
              ? "text-white"
              : "text-white/50 group-hover/sidebar:text-white"
          )}
        >
          {link.name}
          {link.label && (
            <Badge
              className={cn(
                "border-transparent",
                getBadge(link.label.toLowerCase())
              )}
            >
              {link.label}
            </Badge>
          )}
        </motion.span>
        {open && hasSublinks && (
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="ml-auto"
          >
            <ChevronRightIcon className="size-4" />
          </motion.div>
        )}
      </Link>

      <AnimatePresence>
        {isExpanded && open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="space-y-1 ml-6 overflow-hidden"
          >
            {link.sublinks?.map((sublink: any, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <Link
                  href={sublink.href}
                  className={cn(
                    "flex items-center gap-2 w-full py-1 text-3xl rounded-md transition-colors duration-200",
                    pathname === sublink.href
                      ? "text-white"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {sublink.icon && getIcon(sublink.icon)}
                  <span>{sublink.name}</span>
                  {sublink.label && (
                    <Badge
                      className={cn(
                        "border-transparent",
                        getBadge(sublink.label.toLowerCase())
                      )}
                    >
                      {sublink.label}
                    </Badge>
                  )}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppSidebar({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const links = sidebarLinks;
  const [open, setOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<number[]>([]);
  const animate = useState(true);
  return (
    <div
      className={cn(
        "mx-auto flex w-auto h-screen flex-1 flex-col overflow-hidden rounded-md md:flex-row"
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10 font-poppins border-r border-white/10">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto text-2xl">
            {/* Main Nav */}
            <div className="p-4">
              <div className="flex flex-col gap-5 text-3xl">
                {links.map((link, idx) => (
                  <SidebarLinkItem
                    key={idx}
                    link={link}
                    idx={idx}
                    open={open}
                    animate={animate}
                    pathname={pathname}
                    expandedItems={expandedItems}
                    setExpandedItems={setExpandedItems}
                  />
                ))}
              </div>
            </div>
          </div>
        </SidebarBody>
      </Sidebar>
      {/* <Dashboard /> */}
      {children}
    </div>
  );
}

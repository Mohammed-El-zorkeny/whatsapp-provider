"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Smartphone,
  MessageCircle,
  ScrollText,
  Zap,
  BarChart3,
  CreditCard,
  Key,
  Settings,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreditBadge } from "@/components/shared/CreditBadge";
import { UserMenu } from "./UserMenu";
import { useUserStore } from "@/store/user.store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUserStore();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Sessions", href: "/dashboard/sessions", icon: Smartphone },
    { label: "Send Message", href: "/dashboard/messages", icon: MessageCircle },
    { label: "Message Logs", href: "/dashboard/logs", icon: ScrollText },
    { label: "Webhooks", href: "/dashboard/webhooks", icon: Zap },
    { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
    { label: "API Keys", href: "/dashboard/api-keys", icon: Key },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0].toUpperCase() || "U";

  return (
    <div className="w-full md:w-[240px] h-16 md:h-screen bg-surface-1 border-t md:border-t-0 md:border-r border-border/50 fixed bottom-0 md:relative z-40 flex md:flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] md:shadow-none transition-all">
      {/* Top Banner hidden on mobile */}
      <div className="hidden md:flex h-16 items-center px-6 border-b border-border/50 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 bg-primary rounded bg-gradient-to-br from-primary to-accent shadow-lg flex items-center justify-center">
            <LinkIcon className="text-white w-3.5 h-3.5" />
          </div>
          Wa<span className="text-primary">Link</span>
        </Link>
      </div>

      {/* Navigation section */}
      <div className="flex-1 overflow-x-auto md:overflow-y-auto overflow-hidden py-2 md:py-6 px-3 md:px-4 flex md:flex-col gap-1 items-center md:items-stretch hide-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col md:flex-row items-center gap-1 md:gap-3 px-3 py-2 md:py-2.5 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-all shrink-0",
                isActive
                  ? "bg-primary text-white shadow-lg shadow-primary/20 cursor-default"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
              )}
            >
              <Icon className={cn("w-5 h-5 md:w-4 md:h-4 shrink-0", isActive ? "text-white" : "text-text-muted")} />
              <span className="md:inline">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Bottom Section containing CreditBadge & User */}
      <div className="hidden md:flex flex-col gap-4 p-4 border-t border-border/50 shrink-0 bg-background/30 backdrop-blur-sm">
        <CreditBadge className="w-full justify-center bg-surface-2 border-border/50 hover:bg-surface-2/80" />

        <UserMenu triggerClassName="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-2 cursor-pointer transition-colors outline-none ring-offset-background outline-ring focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 bg-primary/20 border border-primary/30">
              <AvatarFallback className="bg-transparent text-primary text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-text-primary truncate leading-tight">
                {user?.full_name || "User"}
              </p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold mt-0.5 opacity-80">
                {user?.plan_id || "FREE"} PLAN
              </p>
            </div>
          </div>
        </UserMenu>
      </div>
    </div>
  );
}
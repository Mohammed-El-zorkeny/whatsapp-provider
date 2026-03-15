"use client";

import { useUserStore } from "@/store/user.store";
import { UserMenu } from "./UserMenu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Coins, AlertTriangle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

/* ── plan-id → monthly credits (mirrors seed.sql) ── */
const PLAN_CREDITS: Record<string, number> = {
  free: 50,
  starter: 1000,
  pro: 5000,
  business: 20000,
};

export function TopBar() {
  const rawPath = usePathname();
  const router = useRouter();
  const { user: userStore } = useUserStore();

  /* ── page title ── */
  const segments = rawPath.split("/").filter(Boolean);
  let title = "Dashboard";
  if (segments.length > 1) {
    const slug = segments[1];
    title = slug.charAt(0).toUpperCase() + slug.slice(1).replace("-", " ");
  }

  /* ── avatar initials ── */
  const initials = userStore?.full_name
    ? userStore.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : userStore?.email?.[0].toUpperCase() || "U";

  /* ── credits logic ── */
  const balance = userStore?.credits_balance ?? 0;
  const planCredits = PLAN_CREDITS[userStore?.plan_id ?? "free"] ?? 50;
  const pct = planCredits > 0 ? (balance / planCredits) * 100 : 0;
  const isEmpty = balance === 0;

  let badgeColor: string;
  let badgeBg: string;
  let badgeBorder: string;
  if (isEmpty || pct < 10) {
    badgeColor = "text-[#FF4D6A]";
    badgeBg = "bg-[#FF4D6A]/10";
    badgeBorder = "border-[#FF4D6A]/25";
  } else if (pct < 20) {
    badgeColor = "text-[#F5A623]";
    badgeBg = "bg-[#F5A623]/10";
    badgeBorder = "border-[#F5A623]/25";
  } else {
    badgeColor = "text-[#00C97A]";
    badgeBg = "bg-[#00C97A]/10";
    badgeBorder = "border-[#00C97A]/25";
  }

  const tooltipText = `${balance} credits remaining — Click to buy more`;

  return (
    <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
      <h1 className="text-xl font-bold tracking-tight text-text-primary capitalize hidden md:block">
        {title}
      </h1>

      {/* Mobile Title */}
      <div className="md:hidden font-bold text-lg text-text-primary">{title}</div>

      <div className="flex items-center gap-3">
        {/* ── Credits Badge ── */}
        <button
          id="credits-badge"
          onClick={() => router.push("/dashboard/billing")}
          title={tooltipText}
          className={[
            "group relative flex items-center gap-1.5 rounded-full border px-3 py-1.5",
            "cursor-pointer transition-all duration-200",
            "hover:scale-105 hover:shadow-lg",
            "outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
            badgeBg,
            badgeBorder,
            badgeColor,
            isEmpty || pct < 10 ? "animate-[pulse_2s_ease-in-out_infinite]" : "",
          ].join(" ")}
        >
          {isEmpty ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <Coins className="w-4 h-4 shrink-0" />
          )}
          <span className="text-sm font-semibold tabular-nums leading-none">
            {balance}
          </span>
          <span className="hidden md:inline text-xs font-medium opacity-80 leading-none">
            credits
          </span>
        </button>

        {/* Notification Bell */}
        <button className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-1 transition-colors relative outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary border-2 border-surface-2"></span>
        </button>

        {/* User Menu Trigger */}
        <UserMenu triggerClassName="flex items-center gap-2 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring rounded-full hover:opacity-80 transition-opacity">
          <Avatar className="h-10 w-10 border border-border/50 bg-primary/20 text-primary hover:border-primary/50 transition-colors cursor-pointer">
            <AvatarFallback className="bg-transparent text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </UserMenu>
      </div>
    </header>
  );
}
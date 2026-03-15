"use client";

import { useUserStore } from "@/store/user.store";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

// Assume we pass standard capacity for plan sizes or dynamically read from profile context.
// In WaLink, Free=100, Starter=5000, Pro=Unlimited etc. 
// We will approximate thresholds based on absolute numbers for universal rendering.
export function CreditBadge({ className }: { className?: string }) {
  const { user } = useUserStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !user) return null;

  const balance = user.credits_balance;
  
  // Logic from prompt:
  // Red if below 10% (approximate < 200 for UI purposes if max not known).
  // Amber if between 10-20% (approx 200 - 500)
  // Green if > 20% (> 500)
  let statusColor = "text-success bg-success/10 border-success/30";
  
  if (balance < 200) {
    statusColor = "text-danger bg-danger/10 border-danger/30";
  } else if (balance < 500) {
    statusColor = "text-warning bg-warning/10 border-warning/30";
  }

  return (
    <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm font-medium text-sm transition-colors", statusColor, className)}>
      <Coins className="w-4 h-4" />
      <span>{balance.toLocaleString()}</span>
    </div>
  );
}

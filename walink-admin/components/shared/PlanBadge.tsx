import { cn } from "@/lib/utils";

const planConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  free: { label: "Free", color: "text-text-secondary", bg: "bg-surface-2", border: "border-border-color" },
  starter: { label: "Starter", color: "text-[#00C97A]", bg: "bg-[#00C97A]/10", border: "border-[#00C97A]/20" },
  pro: { label: "Pro", color: "text-[#6C47FF]", bg: "bg-[#6C47FF]/10", border: "border-[#6C47FF]/20" },
  business: { label: "Business", color: "text-[#F5A623]", bg: "bg-[#F5A623]/10", border: "border-[#F5A623]/20" },
};

interface PlanBadgeProps {
  planId: string;
  className?: string;
}

export function PlanBadge({ planId, className }: PlanBadgeProps) {
  const config = planConfig[planId] || planConfig.free;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        config.color,
        config.bg,
        config.border,
        className
      )}
    >
      {config.label}
    </span>
  );
}

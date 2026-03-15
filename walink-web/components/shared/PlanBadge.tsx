import { cn } from "@/lib/utils";

export function PlanBadge({ plan_id, className }: { plan_id: string; className?: string }) {
  const planMap: Record<string, { label: string; color: string }> = {
    free: { label: "Free", color: "bg-surface-2 text-text-secondary border-border" },
    starter: { label: "Starter", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
    pro: { label: "Pro", color: "bg-primary/10 text-primary border-primary/30" },
    business: { label: "Business", color: "bg-warning/10 text-warning border-warning/30" } // fallback if matched to enterprise
  };

  const planInfo = planMap[plan_id] || planMap.free;

  return (
    <div className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border", planInfo.color, className)}>
      {planInfo.label}
    </div>
  );
}

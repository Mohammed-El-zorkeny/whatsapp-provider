import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  active: { label: "Active", color: "text-[#00C97A]", bg: "bg-[#00C97A]/10", border: "border-[#00C97A]/20", dot: "bg-[#00C97A]" },
  suspended: { label: "Suspended", color: "text-[#FF4D6A]", bg: "bg-[#FF4D6A]/10", border: "border-[#FF4D6A]/20", dot: "bg-[#FF4D6A]" },
  paid: { label: "Paid", color: "text-[#00C97A]", bg: "bg-[#00C97A]/10", border: "border-[#00C97A]/20", dot: "bg-[#00C97A]" },
  pending: { label: "Pending", color: "text-[#F5A623]", bg: "bg-[#F5A623]/10", border: "border-[#F5A623]/20", dot: "bg-[#F5A623]" },
  cancelled: { label: "Cancelled", color: "text-[#FF4D6A]", bg: "bg-[#FF4D6A]/10", border: "border-[#FF4D6A]/20", dot: "bg-[#FF4D6A]" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        config.color,
        config.bg,
        config.border,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

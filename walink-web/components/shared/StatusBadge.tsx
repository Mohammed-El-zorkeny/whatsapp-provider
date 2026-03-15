import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  let config = {
    color: "bg-danger/10 text-danger border-danger/30",
    ping: false,
    label: status
  };

  switch (status) {
    case 'CONNECTED':
      config = { color: "bg-success/10 text-success border-success/30", ping: true, label: "CONNECTED" }; break;
    case 'SCAN_QR_CODE':
      config = { color: "bg-warning/10 text-warning border-warning/30", ping: true, label: "QR READY" }; break;
    case 'STARTING':
      config = { color: "bg-surface-2 text-text-secondary border-border", ping: true, label: "STARTING" }; break;
    case 'STOPPED':
    case 'FAILED':
    case 'DISCONNECTED':
      config = { color: "bg-danger/10 text-danger border-danger/30", ping: false, label: status }; break;
    default:
      config = { color: "bg-surface-2 text-text-secondary border-border", ping: false, label: status || 'UNKNOWN' };
  }

  return (
    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", config.color, className)}>
      {config.ping && (
        <span className="relative flex h-2 w-2">
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", config.color.split(" ")[1]?.replace("text-", "bg-") || "bg-primary")} />
          <span className={cn("relative inline-flex rounded-full h-2 w-2", config.color.split(" ")[1]?.replace("text-", "bg-") || "bg-primary")} />
        </span>
      )}
      {!config.ping && (
         <span className={cn("inline-flex rounded-full h-2 w-2", config.color.split(" ")[1]?.replace("text-", "bg-") || "bg-primary")} />
      )}
      {config.label}
    </div>
  );
}

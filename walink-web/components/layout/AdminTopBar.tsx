"use client";

import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";

export function AdminTopBar() {
  const rawPath = usePathname();

  const segments = rawPath.split("/").filter(Boolean);
  let title = "Dashboard";
  if (segments.length > 1) {
    const slug = segments[segments.length - 1];
    title = slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
  }

  return (
    <header className="h-16 border-b border-border-color/50 bg-background/80 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight text-text-primary capitalize">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
          <Shield className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Admin Mode</span>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useUserStore } from "@/store/user.store";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PlanBadge } from "@/components/shared/PlanBadge";
import { LogOut, User, CreditCard, Key } from "lucide-react";

export function UserMenu({ children, triggerClassName }: { children: React.ReactNode, triggerClassName?: string }) {
  const { user, clearUser } = useUserStore();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    clearUser();
    router.push("/login");
  };

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0].toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClassName}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-surface-1 border-border shadow-2xl">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border/50 bg-primary/20 text-primary">
                <AvatarFallback className="bg-transparent">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col space-y-0.5 overflow-hidden">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user?.full_name || "User"}
                </p>
                <p className="text-xs text-text-muted truncate">{user?.email}</p>
              </div>
            </div>
            <div className="mt-3">
              <PlanBadge plan_id={user?.plan_id || "free"} />
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem
          className="cursor-pointer text-text-secondary hover:text-text-primary hover:bg-surface-2 focus:bg-surface-2 focus:text-text-primary py-2.5"
          onClick={() => router.push("/dashboard/settings")}
        >
          <User className="mr-2 h-4 w-4" />
          <span>Profile Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer text-text-secondary hover:text-text-primary hover:bg-surface-2 focus:bg-surface-2 focus:text-text-primary py-2.5"
          onClick={() => router.push("/dashboard/billing")}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          <span>Billing</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer text-text-secondary hover:text-text-primary hover:bg-surface-2 focus:bg-surface-2 focus:text-text-primary py-2.5"
          onClick={() => router.push("/dashboard/api-keys")}
        >
          <Key className="mr-2 h-4 w-4" />
          <span>API Keys</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem
          className="cursor-pointer text-danger hover:text-danger hover:bg-danger/10 focus:bg-danger/10 focus:text-danger py-2.5"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
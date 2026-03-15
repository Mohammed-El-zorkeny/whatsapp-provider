import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StoreInitializer } from "@/components/layout/StoreInitializer";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-background text-text-primary overflow-hidden">
      {/* Sidebar hidden on mobile till bottom nav */}
      <StoreInitializer />
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative pb-16 md:pb-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
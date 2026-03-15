import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardCharts } from "./DashboardCharts";
import { Users, MessageSquare, CreditCard, TrendingUp, ArrowUpRight } from "lucide-react";
import { PlanBadge } from "@/components/shared/PlanBadge";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: string;
}

function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border-color/50 bg-surface-1 p-5 hover:border-primary/20 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-secondary">{title}</p>
          <p className="text-3xl font-bold text-text-primary mt-1">{value}</p>
          <p className="text-xs text-text-muted mt-1">{subtitle}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3 text-xs text-success">
          <ArrowUpRight className="w-3 h-3" />
          {trend}
        </div>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = createAdminClient();

  // Fetch stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { count: totalUsers },
    { count: totalMessages },
    { data: creditPurchasesData },
    { data: recentUsers },
    { data: activeUsersData },
    { data: dailyUsers },
    { data: dailyMessages },
    { data: planDistribution },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user"),
    supabase.from("message_logs").select("*", { count: "exact", head: true }),
    supabase.from("credit_transactions").select("amount").eq("type", "purchase"),
    supabase
      .from("profiles")
      .select("id, full_name, email, plan_id, credits_balance, created_at")
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("message_logs")
      .select("user_id")
      .gte("created_at", monthStart),
    // Daily new users last 30 days
    supabase
      .from("profiles")
      .select("created_at")
      .eq("role", "user")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at"),
    // Daily messages last 30 days
    supabase
      .from("message_logs")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at"),
    // Plan distribution
    supabase.from("profiles").select("plan_id").eq("role", "user"),
  ]);

  const totalCreditsSold = creditPurchasesData?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
  const activeUserIds = new Set(activeUsersData?.map((m) => m.user_id) || []);

  // Aggregate daily users
  const dailyUsersMap: Record<string, number> = {};
  dailyUsers?.forEach((u) => {
    const day = format(new Date(u.created_at), "MMM dd");
    dailyUsersMap[day] = (dailyUsersMap[day] || 0) + 1;
  });
  const dailyUsersChart = Object.entries(dailyUsersMap).map(([name, users]) => ({ name, users }));

  // Aggregate daily messages
  const dailyMessagesMap: Record<string, number> = {};
  dailyMessages?.forEach((m) => {
    const day = format(new Date(m.created_at), "MMM dd");
    dailyMessagesMap[day] = (dailyMessagesMap[day] || 0) + 1;
  });
  const dailyMessagesChart = Object.entries(dailyMessagesMap).map(([name, messages]) => ({ name, messages }));

  // Plan distribution
  const planCountMap: Record<string, number> = {};
  planDistribution?.forEach((p) => {
    planCountMap[p.plan_id] = (planCountMap[p.plan_id] || 0) + 1;
  });
  const planChart = Object.entries(planCountMap).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={totalUsers || 0}
          subtitle="Registered users"
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Active This Month"
          value={activeUserIds.size}
          subtitle="Users who sent messages"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Messages Sent"
          value={(totalMessages || 0).toLocaleString()}
          subtitle="All time"
          icon={<MessageSquare className="w-5 h-5" />}
        />
        <StatCard
          title="Credits Sold"
          value={totalCreditsSold.toLocaleString()}
          subtitle="Total purchased"
          icon={<CreditCard className="w-5 h-5" />}
        />
      </div>

      {/* Charts */}
      <DashboardCharts
        dailyUsersData={dailyUsersChart}
        dailyMessagesData={dailyMessagesChart}
        planDistData={planChart}
      />

      {/* Recent Users Table */}
      <div className="rounded-xl border border-border-color/50 bg-surface-1 overflow-hidden">
        <div className="px-5 py-4 border-b border-border-color/50">
          <h2 className="text-lg font-semibold text-text-primary">Recent Registrations</h2>
          <p className="text-sm text-text-muted mt-0.5">Last 10 users who signed up</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color/30">
                <th className="text-left px-5 py-3 text-text-muted font-medium">User</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Plan</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Credits</th>
                <th className="text-left px-5 py-3 text-text-muted font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers?.map((u) => (
                <tr key={u.id} className="border-b border-border-color/20 hover:bg-surface-2/50 transition-colors">
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-medium text-text-primary">{u.full_name || "—"}</p>
                      <p className="text-xs text-text-muted">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <PlanBadge planId={u.plan_id} />
                  </td>
                  <td className="px-5 py-3 font-mono text-text-secondary">{u.credits_balance}</td>
                  <td className="px-5 py-3 text-text-muted">
                    {format(new Date(u.created_at), "MMM dd, yyyy")}
                  </td>
                </tr>
              ))}
              {(!recentUsers || recentUsers.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-text-muted">
                    No users registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

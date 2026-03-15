"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const PIE_COLORS = ["#5E5C7A", "#00C97A", "#6C47FF", "#F5A623"];

interface DashboardChartsProps {
  dailyUsersData: { name: string; users: number }[];
  dailyMessagesData: { name: string; messages: number }[];
  planDistData: { name: string; value: number }[];
}

export function DashboardCharts({
  dailyUsersData,
  dailyMessagesData,
  planDistData,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* New Users Bar Chart */}
      <div className="rounded-xl border border-border-color/50 bg-surface-1 p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">New Users (30 days)</h3>
        <div className="h-56">
          {dailyUsersData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyUsersData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3D" />
                <XAxis dataKey="name" tick={{ fill: "#5E5C7A", fontSize: 10 }} axisLine={{ stroke: "#2A2A3D" }} />
                <YAxis tick={{ fill: "#5E5C7A", fontSize: 10 }} axisLine={{ stroke: "#2A2A3D" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1C1C2E", border: "1px solid #2A2A3D", borderRadius: 8, color: "#F0EFFF" }}
                />
                <Bar dataKey="users" fill="#F5A623" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Messages Line Chart */}
      <div className="rounded-xl border border-border-color/50 bg-surface-1 p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Messages (30 days)</h3>
        <div className="h-56">
          {dailyMessagesData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyMessagesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3D" />
                <XAxis dataKey="name" tick={{ fill: "#5E5C7A", fontSize: 10 }} axisLine={{ stroke: "#2A2A3D" }} />
                <YAxis tick={{ fill: "#5E5C7A", fontSize: 10 }} axisLine={{ stroke: "#2A2A3D" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1C1C2E", border: "1px solid #2A2A3D", borderRadius: 8, color: "#F0EFFF" }}
                />
                <Line type="monotone" dataKey="messages" stroke="#00C97A" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Plan Distribution Donut */}
      <div className="rounded-xl border border-border-color/50 bg-surface-1 p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Users by Plan</h3>
        <div className="h-56">
          {planDistData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planDistData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {planDistData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1C1C2E", border: "1px solid #2A2A3D", borderRadius: 8, color: "#F0EFFF" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "#9896B8" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted text-sm">No data yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

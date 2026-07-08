import React, { useEffect, useState } from "react";
import useSWR from "swr";
import { api, formatINR } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import {
  TrendingUp, ShoppingBag, Wallet, Package, Users2, AlertTriangle,
  IndianRupee, ArrowUpRight,
} from "lucide-react";

const fetcher = (url) => api.get(url).then((r) => r.data);

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#14B8A6", "#F97316", "#EC4899"];

function KpiCard({ icon: Icon, label, value, hint, testid, tone = "default" }) {
  return (
    <Card className="glass rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg" data-testid={testid}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
          <div className={`grid h-8 w-8 place-items-center rounded-lg ${tone === "warn" ? "bg-amber-500/10 text-amber-600" : "bg-primary/5 text-primary"}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 text-2xl md:text-3xl font-bold tracking-tighter" style={{ fontFamily: "Outfit" }}>
          {value}
        </div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data, error, isLoading } = useSWR("/dashboard/summary", fetcher, { refreshInterval: 30000 });

  if (error) return <div className="text-destructive">Failed to load dashboard.</div>;
  if (isLoading || !data) return <div className="text-muted-foreground">Loading dashboard…</div>;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Overview</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "Outfit" }}>Store Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time snapshot of sales, inventory and customer activity.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard testid="kpi-today-sales" icon={IndianRupee} label="Today's Sales" value={formatINR(data.today_sales)} hint="Revenue in the last 24h" />
        <KpiCard testid="kpi-month-sales" icon={TrendingUp} label="Monthly Sales" value={formatINR(data.month_sales)} hint="Month to date" />
        <KpiCard testid="kpi-profit" icon={ArrowUpRight} label="Today's Profit" value={formatINR(data.today_profit)} hint="Est. margin" />
        <KpiCard testid="kpi-outstanding" icon={Wallet} label="Outstanding" value={formatINR(data.outstanding_payments)} hint="Credit sales due" />
        <KpiCard testid="kpi-stock-value" icon={Package} label="Stock Value" value={formatINR(data.stock_value)} hint={`${data.total_units} units in hand`} />
        <KpiCard testid="kpi-low-stock" icon={AlertTriangle} label="Low Stock" value={data.low_stock_count} hint="Items to reorder" tone="warn" />
        <KpiCard testid="kpi-customers" icon={Users2} label="Customers" value={data.customer_count} hint="Registered" />
        <KpiCard testid="kpi-pending" icon={ShoppingBag} label="Pending" value={data.pending_orders} hint="Credit / installation" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass rounded-2xl lg:col-span-2" data-testid="chart-sales-trend">
          <CardHeader>
            <CardTitle style={{ fontFamily: "Outfit" }}>Sales — last 7 days</CardTitle>
            <CardDescription>Daily revenue in INR</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.sales_trend}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                    formatter={(v) => formatINR(v)}
                  />
                  <Area type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2.5} fill="url(#salesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass rounded-2xl" data-testid="chart-category">
          <CardHeader>
            <CardTitle style={{ fontFamily: "Outfit" }}>Category mix</CardTitle>
            <CardDescription>Revenue by product category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {data.category_breakdown.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No sales yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.category_breakdown} dataKey="value" nameKey="category" outerRadius={90} innerRadius={50}>
                      {data.category_breakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass rounded-2xl" data-testid="card-top-products">
          <CardHeader>
            <CardTitle style={{ fontFamily: "Outfit" }}>Best selling</CardTitle>
            <CardDescription>Top revenue drivers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.top_products.length === 0 && <div className="text-sm text-muted-foreground">No data</div>}
              {data.top_products.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 shrink-0 grid place-items-center rounded-md bg-primary/10 text-primary text-xs font-semibold">
                      #{i + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.qty} units sold</div>
                    </div>
                  </div>
                  <div className="font-semibold text-sm">{formatINR(p.revenue)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass rounded-2xl" data-testid="card-low-stock">
          <CardHeader>
            <CardTitle style={{ fontFamily: "Outfit" }}>Low stock alerts</CardTitle>
            <CardDescription>Reorder soon to avoid stockouts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.low_stock_items.length === 0 && (
                <div className="text-sm text-muted-foreground">All good — nothing running low.</div>
              )}
              {data.low_stock_items.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">SKU {p.sku}</div>
                  </div>
                  <div className="text-sm font-semibold text-amber-600">{p.quantity} left</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

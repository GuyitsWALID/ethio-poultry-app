"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/utils/supabase/client";

type SalesOrder = {
  id: string;
  order_number: string;
  order_date: string | null;
  customer_id: string | null;
  status: string;
  total_amount: number | null;
};

export default function SalesPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCeoReadOnly, setIsCeoReadOnly] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const contextResponse = await fetch("/api/me/context", { method: "GET" });
      const context = contextResponse.ok ? await contextResponse.json() : null;
      const role = String(context?.role ?? "");
      setIsCeoReadOnly(role === "ceo");

      const orgId = context?.orgId as string | null;
      if (!orgId) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from("sales_orders")
        .select("id, order_number, order_date, customer_id, status, total_amount")
        .eq("org_id", orgId)
        .order("order_date", { ascending: false })
        .limit(120);

      setOrders((data ?? []) as SalesOrder[]);
      setLoading(false);
    };
    void load();
  }, []);

  const dailyTrend = useMemo(() => {
    const map = new Map<string, { date: string; total: number; count: number }>();
    orders.forEach((order) => {
      const date = order.order_date ?? "unknown";
      const current = map.get(date) ?? { date, total: 0, count: 0 };
      current.total += order.total_amount ?? 0;
      current.count += 1;
      map.set(date, current);
    });
    return Array.from(map.values())
      .filter((row) => row.date !== "unknown")
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(-14);
  }, [orders]);

  const maxDailyTotal = Math.max(1, ...dailyTrend.map((d) => d.total));
  const totalSales = orders.reduce((acc, order) => acc + (order.total_amount ?? 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = orders
    .filter((order) => order.order_date === today)
    .reduce((acc, order) => acc + (order.total_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Sales</p>
        <h2 className="text-2xl font-semibold text-forest-900">Sales visibility and growth</h2>
        <p className="mt-2 text-sm text-forest-600">
          Daily sales records and trend analytics.
          {isCeoReadOnly ? " CEO is view-only on this page." : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Total Sales</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{totalSales.toLocaleString()}</p>
        </article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Today Sales</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{todaySales.toLocaleString()}</p>
        </article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Orders</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{orders.length}</p>
        </article>
      </div>

      <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-forest-900">Daily Sales Trend (Last 14 days)</h3>
        {dailyTrend.length === 0 ? (
          <p className="mt-3 text-sm text-forest-600">No sales trend data available.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {dailyTrend.map((row) => (
              <div key={row.date} className="grid grid-cols-[90px_1fr_110px] items-center gap-3">
                <span className="text-xs text-forest-600">{row.date}</span>
                <div className="h-3 rounded bg-sand-100">
                  <div
                    className="h-3 rounded bg-forest-700"
                    style={{ width: `${Math.max(2, Math.round((row.total / maxDailyTotal) * 100))}%` }}
                  />
                </div>
                <span className="text-xs text-forest-700">{row.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-forest-900">Sales Records</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                <th className="px-2 py-2">Order</th>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={4}>
                    Loading sales records...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={4}>
                    No sales records found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-sand-100">
                    <td className="px-2 py-2 font-medium text-forest-900">{order.order_number}</td>
                    <td className="px-2 py-2 text-forest-700">{order.order_date ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{order.status}</td>
                    <td className="px-2 py-2 text-forest-700">{(order.total_amount ?? 0).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

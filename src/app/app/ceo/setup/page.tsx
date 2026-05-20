"use client";

import React, { useState, useEffect } from "react";
import { Archive, Building2, MapPin, Loader2, Plus, Search } from "lucide-react";
import { SetupModal } from "@/components/ceo/setup-modal";

type HierarchyRow = {
  key: string;
  branchName: string;
  branchLocation: string;
  farmName: string;
  houseName: string;
  flockCode: string;
  batchCode: string;
  batchStatus: string;
};

type BranchSummaryRow = {
  key: string;
  branchName: string;
  branchLocation: string;
  farmCount: number;
  houseCount: number;
  flockCount: number;
  batchItems: Array<{ batchCode: string; batchStatus: string }>;
};

export default function BranchListPage() {
  const [rows, setRows] = useState<HierarchyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadBranches = async () => {
    setLoading(true);
    const response = await fetch("/api/ceo/branch-hierarchy", { method: "GET" });
    if (!response.ok) {
      setRows([]);
      setLoading(false);
      return;
    }
    const data = await response.json();
    setRows((data?.rows ?? []) as HierarchyRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRows = rows.filter((row) =>
    [row.branchName, row.branchLocation, row.farmName, row.houseName, row.flockCode, row.batchCode]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );

  const branchSummaryRows: BranchSummaryRow[] = Array.from(
    filteredRows.reduce((acc, row) => {
      const key = `${row.branchName}::${row.branchLocation}`;
      if (!acc.has(key)) {
        acc.set(key, {
          key,
          branchName: row.branchName,
          branchLocation: row.branchLocation,
          farmSet: new Set<string>(),
          houseSet: new Set<string>(),
          flockSet: new Set<string>(),
          batchMap: new Map<string, string>(),
        });
      }

      const entry = acc.get(key)!;
      if (row.farmName !== "-") entry.farmSet.add(row.farmName);
      if (row.houseName !== "-") entry.houseSet.add(row.houseName);
      if (row.flockCode !== "-") entry.flockSet.add(row.flockCode);
      if (row.batchCode !== "-") entry.batchMap.set(row.batchCode, row.batchStatus);
      return acc;
    }, new Map<string, {
      key: string;
      branchName: string;
      branchLocation: string;
      farmSet: Set<string>;
      houseSet: Set<string>;
      flockSet: Set<string>;
      batchMap: Map<string, string>;
    }>())
  ).map(([, value]) => ({
    key: value.key,
    branchName: value.branchName,
    branchLocation: value.branchLocation,
    farmCount: value.farmSet.size,
    houseCount: value.houseSet.size,
    flockCount: value.flockSet.size,
    batchItems: Array.from(value.batchMap.entries()).map(([batchCode, batchStatus]) => ({
      batchCode,
      batchStatus,
    })),
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-forest-700" />
          <h1 className="text-3xl font-bold text-forest-900">Branch Network</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-forest-400" />
            <input
              type="text"
              placeholder="Search branches..."
              className="pl-9 pr-4 py-2 rounded-lg border border-sand-200 bg-white text-sm outline-none focus:ring-2 focus:ring-forest-600 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-forest-900 text-sand-50 rounded-lg font-medium hover:bg-forest-800 transition-colors"
          >
            <Plus className="h-5 w-5" />
            New Branch
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-forest-600" />
        </div>
      ) : branchSummaryRows.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-sand-300">
          <p className="text-forest-600">No branches found matching your search.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-sand-50 text-left text-xs uppercase tracking-[0.14em] text-forest-600">
                <tr>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Farms</th>
                  <th className="px-4 py-3">Houses</th>
                  <th className="px-4 py-3">Flocks</th>
                  <th className="px-4 py-3">Batch IDs</th>
                </tr>
              </thead>
              <tbody>
                {branchSummaryRows.map((row) => (
                  <tr key={row.key} className="border-t border-sand-100 text-forest-800">
                    <td className="px-4 py-3 font-medium">{row.branchName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-forest-500" />
                        {row.branchLocation}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.farmCount}</td>
                    <td className="px-4 py-3">{row.houseCount}</td>
                    <td className="px-4 py-3">{row.flockCount}</td>
                    <td className="px-4 py-3">
                      {row.batchItems.length === 0 ? (
                        "-"
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {row.batchItems.map((batch) => {
                            const isActive = (batch.batchStatus || "").trim().toLowerCase() === "active";
                            return (
                              <span
                                key={`${row.key}-${batch.batchCode}`}
                                className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-white px-2 py-1 text-xs"
                                title={isActive ? "Active batch (live)" : `Non-active batch (${batch.batchStatus || "unknown"})`}
                              >
                                {isActive ? (
                                  <span className="relative inline-flex h-2.5 w-2.5 items-center justify-center">
                                    <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-green-500/70" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                                  </span>
                                ) : (
                                  <Archive className="h-3.5 w-3.5 text-forest-500" />
                                )}
                                <span>{batch.batchCode}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-sand-100 bg-sand-50/60 px-4 py-2 text-xs text-forest-600">
            {branchSummaryRows.length} branch row{branchSummaryRows.length === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {isModalOpen && (
        <SetupModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={loadBranches}
        />
      )}
    </div>
  );
}

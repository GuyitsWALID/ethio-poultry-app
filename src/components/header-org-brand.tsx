"use client";

import { useEffect, useState } from "react";

export function HeaderOrgBrand({ className = "text-lg font-semibold text-forest-900" }: { className?: string }) {
  const [orgName, setOrgName] = useState("Operations Hub");

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/me/context", { method: "GET" });
      if (!response.ok) return;
      const data = await response.json();
      const next = String(data?.orgName ?? "").trim();
      if (next) setOrgName(next);
    };
    void load();
  }, []);

  return <span className={className}>{orgName}</span>;
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, Plus, Eye, EyeOff, Copy, RefreshCw, Check } from "lucide-react";

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FarmConfig {
  name: string;
  houses: Array<{
    name: string;
    capacity: number;
    flocks: Array<Record<string, never>>;
  }>;
}

interface SetupData {
  branch: { name: string; location: string };
  intakeBatch: {
    source: "internal_transfer" | "external_purchase";
    supplier_name: string;
    purchase_date: string;
    placement_date: string;
    total_count: number;
    purchase_cost_per_bird: number;
    transport_cost: number;
    other_cost: number;
    total_cost: number;
    notes: string;
  };
  farms: FarmConfig[];
  manager: {
    email: string;
    phone: string;
    fullName: string;
    password: string;
  };
}

const initialData: SetupData = {
  branch: { name: "", location: "" },
  intakeBatch: {
    source: "external_purchase",
    supplier_name: "",
    purchase_date: "",
    placement_date: "",
    total_count: 0,
    purchase_cost_per_bird: 0,
    transport_cost: 0,
    other_cost: 0,
    total_cost: 0,
    notes: "",
  },
  farms: [],
  manager: {
    email: "",
    phone: "",
    fullName: "",
    password: "",
  },
};

export function SetupModal({ isOpen, onClose, onSuccess }: SetupModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [formData, setFormData] = useState(initialData);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const totalHouseCapacity = useMemo(
    () =>
      (formData.farms || []).reduce(
        (farmAcc, farm) =>
          farmAcc +
          (farm.houses || []).reduce(
            (houseAcc, house) => houseAcc + (Number(house.capacity) || 0),
            0
          ),
        0
      ),
    [formData.farms]
  );

  const intakeTotalCount = Number(formData.intakeBatch?.total_count) || 0;
  const capacityMatchesBatchTotal = intakeTotalCount > 0 && totalHouseCapacity === intakeTotalCount;

  const updateBranch = <K extends keyof SetupData["branch"]>(field: K, value: SetupData["branch"][K]) => {
    setFormData(prev => ({ ...prev, branch: { ...prev.branch, [field]: value } }));
  };

  const updateIntake = (field: keyof SetupData["intakeBatch"], value: string | number) => {
    setFormData(prev => ({ ...prev, intakeBatch: { ...prev.intakeBatch, [field]: value } as SetupData["intakeBatch"] }));
  };

  const addFarm = () => {
    setFormData(prev => ({
      ...prev,
      farms: [...(prev.farms || []), { name: "", houses: [] }]
    }));
  };

  const removeFarm = (index: number) => {
    setFormData(prev => ({
      ...prev,
      farms: (prev.farms || []).filter((_, i) => i !== index)
    }));
  };

  const updateFarm = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const updated = [...(prev.farms || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, farms: updated };
    });
  };

  const addHouseToFarm = (farmIndex: number) => {
    setFormData(prev => {
      const farms = (prev.farms || []).map((farm, index) =>
        index === farmIndex
          ? {
              ...farm,
              houses: [...(farm.houses || []), { name: "", capacity: 0, flocks: [] }],
            }
          : farm
      );
      return { ...prev, farms };
    });
  };

  const removeHouse = (farmIndex: number, houseIndex: number) => {
    setFormData(prev => {
      const farms = (prev.farms || []).map((farm, index) =>
        index === farmIndex
          ? {
              ...farm,
              houses: (farm.houses || []).filter((_, i) => i !== houseIndex),
            }
          : farm
      );
      return { ...prev, farms };
    });
  };

  const updateHouse = (farmIndex: number, houseIndex: number, field: keyof FarmConfig["houses"][number], value: string | number) => {
    setFormData(prev => {
      const farms = (prev.farms || []).map((farm, index) => {
        if (index !== farmIndex) return farm;
        const houses = (farm.houses || []).map((house, i) =>
          i === houseIndex ? { ...house, [field]: value } : house
        );
        return { ...farm, houses };
      });
      return { ...prev, farms };
    });
  };

  const addFlockToHouse = (farmIndex: number, houseIndex: number) => {
    setFormData(prev => {
      const farms = (prev.farms || []).map((farm, index) => {
        if (index !== farmIndex) return farm;
        const houses = (farm.houses || []).map((house, i) =>
          i === houseIndex ? { ...house, flocks: [...(house.flocks || []), {}] } : house
        );
        return { ...farm, houses };
      });
      return { ...prev, farms };
    });
  };

  const removeFlock = (farmIndex: number, houseIndex: number, flockIndex: number) => {
    setFormData(prev => {
      const farms = (prev.farms || []).map((farm, index) => {
        if (index !== farmIndex) return farm;
        const houses = (farm.houses || []).map((house, i) =>
          i === houseIndex
            ? { ...house, flocks: (house.flocks || []).filter((_, j) => j !== flockIndex) }
            : house
        );
        return { ...farm, houses };
      });
      return { ...prev, farms };
    });
  };

  const updateManager = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, manager: { ...(prev.manager || {}), [field]: value } }));
  };

  const generatePassword = () => {
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    const length = 14;
    let nextPassword = "";
    for (let i = 0; i < length; i += 1) {
      nextPassword += charset[Math.floor(Math.random() * charset.length)];
    }
    updateManager("password", nextPassword);
    setCopiedPassword(false);
  };

  const copyPassword = async () => {
    const password = formData.manager?.password ?? "";
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 1500);
    } catch {
      setError("Failed to copy password. Please copy manually.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!capacityMatchesBatchTotal) {
      setError(
        `House capacity total (${totalHouseCapacity}) must equal batch total count (${intakeTotalCount}) before submission.`
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/ceo/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || "Setup failed");

      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-sand-200"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-forest-900">Branch Setup Command Center</h2>
            <button type="button" onClick={onClose} className="p-2 text-forest-400 hover:text-forest-600 transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-8">
            {/* Branch Section */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-forest-800 border-b border-sand-200 pb-2">1. Branch Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-forest-700">Branch Name</label>
                  <input
                    required
                    className="w-full rounded-lg border border-sand-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-forest-600"
                    value={formData.branch?.name}
                    onChange={(e) => updateBranch("name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-forest-700">Location</label>
                  <input
                    required
                    className="w-full rounded-lg border border-sand-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-forest-600"
                    value={formData.branch?.location}
                    onChange={(e) => updateBranch("location", e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Intake Section */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-forest-800 border-b border-sand-200 pb-2">2. Initial Intake Batch</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-forest-700">Source</label>
                  <select
                    className="w-full rounded-lg border border-sand-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-forest-600"
                    value={formData.intakeBatch?.source}
                    onChange={(e) => updateIntake("source", e.target.value)}
                  >
                    <option value="internal_transfer">Internal Transfer</option>
                    <option value="external_purchase">External Purchase</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-forest-700">Placement Date</label>
                  <input
                    required
                    type="date"
                    className="w-full rounded-lg border border-sand-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-forest-600"
                    value={formData.intakeBatch?.placement_date}
                    onChange={(e) => updateIntake("placement_date", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-forest-700">Total Count</label>
                  <input
                    required
                    type="number"
                    className="w-full rounded-lg border border-sand-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-forest-600"
                    value={formData.intakeBatch?.total_count}
                    onChange={(e) => updateIntake("total_count", parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-forest-700">Supplier</label>
                  <input
                    className="w-full rounded-lg border border-sand-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-forest-600"
                    value={formData.intakeBatch?.supplier_name}
                    onChange={(e) => updateIntake("supplier_name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-forest-700">Cost per Bird</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-lg border border-sand-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-forest-600"
                    value={formData.intakeBatch?.purchase_cost_per_bird}
                    onChange={(e) => updateIntake("purchase_cost_per_bird", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-forest-700">Notes</label>
                  <input
                    className="w-full rounded-lg border border-sand-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-forest-600"
                    value={formData.intakeBatch?.notes}
                    onChange={(e) => updateIntake("notes", e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Farms Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-sand-200 pb-2">
                <h3 className="text-lg font-semibold text-forest-800">3. Infrastructure Hierarchy</h3>
                <button
                  type="button"
                  onClick={addFarm}
                  className="flex items-center gap-1 px-3 py-1 bg-forest-100 text-forest-700 rounded-md text-xs font-bold hover:bg-forest-200 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add Farm
                </button>
              </div>
              <div className="space-y-8">
                {(formData.farms || []).map((farm, farmIndex) => (
                  <div key={farmIndex} className="p-6 bg-sand-50 rounded-2xl border border-sand-200 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-forest-200 text-forest-700 text-xs font-bold rounded-md">FARM {farmIndex + 1}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFarm(farmIndex)}
                        className="text-red-400 hover:text-red-600 text-xs font-medium"
                      >
                        Remove Farm
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-forest-600">Farm Name</label>
                        <input
                          required
                          className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-600"
                          value={farm.name}
                          onChange={(e) => updateFarm(farmIndex, "name", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-4 pl-4 border-l-2 border-forest-200">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-forest-700 uppercase">Houses</h4>
                        <button
                          type="button"
                          onClick={() => addHouseToFarm(farmIndex)}
                          className="flex items-center gap-1 px-2 py-1 bg-white border border-forest-200 text-forest-600 rounded text-[10px] font-bold hover:bg-forest-50 transition-colors"
                        >
                          <Plus className="h-3 w-3" /> Add House
                        </button>
                      </div>

                      <div className="space-y-6">
                        {(farm.houses || []).map((house, houseIndex) => (
                          <div key={houseIndex} className="p-4 bg-white rounded-xl border border-sand-200 space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-forest-500 uppercase">House {houseIndex + 1}</span>
                              <button
                                type="button"
                                onClick={() => removeHouse(farmIndex, houseIndex)}
                                className="text-red-400 hover:text-red-600 text-[10px] font-medium"
                              >
                                Remove House
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] text-forest-600">House Name</label>
                                <input
                                  required
                                  className="w-full rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-forest-600"
                                  value={house.name}
                                  onChange={(e) => updateHouse(farmIndex, houseIndex, "name", e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-forest-600">Capacity</label>
                                <input
                                  required
                                  type="number"
                                  className="w-full rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-forest-600"
                                  value={house.capacity}
                                  onChange={(e) => updateHouse(farmIndex, houseIndex, "capacity", parseInt(e.target.value) || 0)}
                                />
                              </div>
                            </div>

                            <div className="space-y-3 pl-3 border-l border-sand-200">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-forest-400 uppercase">Flocks</span>
                                <button
                                  type="button"
                                  onClick={() => addFlockToHouse(farmIndex, houseIndex)}
                                  className="flex items-center gap-1 px-2 py-1 bg-sand-50 border border-sand-200 text-forest-500 rounded text-[9px] font-bold hover:bg-sand-100 transition-colors"
                                >
                                  <Plus className="h-2.5 w-2.5" /> Add Flock
                                </button>
                              </div>
                              <div className="space-y-3">
                                {(house.flocks || []).map((flock, flockIndex) => (
                                  <div key={flockIndex} className="p-3 bg-sand-50/50 rounded-lg border border-sand-100 space-y-2 relative group">
                                    <button
                                      type="button"
                                      onClick={() => removeFlock(farmIndex, houseIndex, flockIndex)}
                                      className="absolute top-2 right-2 text-red-300 hover:text-red-500 transition-colors"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      <div className="space-y-1">
                                        <span className="text-[9px] text-forest-400 italic">Flock ID auto-generated</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-sand-200 bg-white px-4 py-3 text-xs">
                      <p className="font-semibold text-forest-700">
                        Capacity Check: Houses total = {totalHouseCapacity} | Batch total = {intakeTotalCount}
                      </p>
                      {!capacityMatchesBatchTotal ? (
                        <p className="mt-1 text-red-600">
                          Warning: house capacities must add up exactly to the batch total count before you can initialize.
                        </p>
                      ) : (
                        <p className="mt-1 text-forest-600">Looks good. Totals are aligned.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Manager Section */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-forest-800 border-b border-sand-200 pb-2">4. Farm Manager Credentials</h3>
              <div className="grid grid-cols-1 gap-4 max-w-xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-forest-700">Full Name</label>
                  <input
                    required
                    className="w-full rounded-lg border border-sand-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-forest-600"
                    value={formData.manager?.fullName}
                    onChange={(e) => updateManager("fullName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-forest-700">Email</label>
                  <input
                    required
                    type="email"
                    className="w-full rounded-lg border border-sand-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-forest-600"
                    value={formData.manager?.email}
                    onChange={(e) => updateManager("email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-forest-700">Phone</label>
                  <input
                    required
                    type="tel"
                    className="w-full rounded-lg border border-sand-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-forest-600"
                    value={formData.manager?.phone ?? ""}
                    onChange={(e) => updateManager("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-forest-700">Password</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        required
                        type={showPassword ? "text" : "password"}
                        className="w-full rounded-lg border border-sand-200 bg-white px-4 py-2 pr-11 outline-none focus:ring-2 focus:ring-forest-600"
                        value={formData.manager?.password}
                        onChange={(e) => updateManager("password", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-forest-500 hover:bg-sand-100"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="inline-flex items-center justify-center rounded-lg border border-sand-200 bg-sand-50 p-2 text-forest-700 hover:bg-sand-100"
                      aria-label="Generate password"
                      title="Generate password"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={copyPassword}
                      className="inline-flex items-center justify-center rounded-lg border border-sand-200 bg-sand-50 p-2 text-forest-700 hover:bg-sand-100"
                      aria-label={copiedPassword ? "Password copied" : "Copy password"}
                      title={copiedPassword ? "Copied" : "Copy password"}
                    >
                      {copiedPassword ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-sand-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-forest-600 hover:text-forest-900 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !capacityMatchesBatchTotal}
              className="flex items-center gap-2 px-8 py-2 bg-forest-900 text-sand-50 rounded-lg font-medium hover:bg-forest-800 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Initialize Branch Hierarchy"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

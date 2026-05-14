"use client";

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2, X, Plus } from "lucide-react";

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FarmConfig {
  name: string;
  location: string;
  houses: Array<{
    name: string;
    capacity: number;
    flocks: Array<{
      type: string;
      age_at_placement_weeks: number;
      template_id: string;
    }>;
  }>;
}

interface SetupData {
  orgId: string;
  branch: { name: string; location: string };
  intakeBatch: {
    source: "internal" | "external";
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
    fullName: string;
    password: string;
  };
}

const initialData: Partial<SetupData> = {
  branch: { name: "", location: "" },
  intakeBatch: {
    source: "external",
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
    fullName: "",
    password: "",
  },
};

export function SetupModal({ isOpen, onClose, onSuccess }: SetupModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const [formData, setFormData] = useState(initialData);

  const updateBranch = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, branch: { ...prev.branch, [field]: value } }));
  };

  const updateIntake = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, intakeBatch: { ...prev.intakeBatch, [field]: value } }));
  };

  const addFarm = () => {
    setFormData(prev => ({
      ...prev,
      farms: [...(prev.farms || []), { name: "", location: "", houses: [] }]
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
      const updatedFarms = [...(prev.farms || [])];
      updatedFarms[farmIndex].houses.push({ name: "", capacity: 0, flocks: [] });
      return { ...prev, farms: updatedFarms };
    });
  };

  const removeHouse = (farmIndex: number, houseIndex: number) => {
    setFormData(prev => {
      const updatedFarms = [...(prev.farms || [])];
      updatedFarms[farmIndex].houses = updatedFarms[farmIndex].houses.filter((_, i) => i !== houseIndex);
      return { ...prev, farms: updatedFarms };
    });
  };

  const updateHouse = (farmIndex: number, houseIndex: number, field: string, value: any) => {
    setFormData(prev => {
      const updatedFarms = [...(prev.farms || [])];
      updatedFarms[farmIndex].houses[houseIndex] = { ...updatedFarms[farmIndex].houses[houseIndex], [field]: value };
      return { ...prev, farms: updatedFarms };
    });
  };

  const addFlockToHouse = (farmIndex: number, houseIndex: number) => {
    setFormData(prev => {
      const updatedFarms = [...(prev.farms || [])];
      updatedFarms[farmIndex].houses[houseIndex].flocks.push({
        type: "",
        age_at_placement_weeks: 0,
        template_id: "",
      });
      return { ...prev, farms: updatedFarms };
    });
  };

  const removeFlock = (farmIndex: number, houseIndex: number, flockIndex: number) => {
    setFormData(prev => {
      const updatedFarms = [...(prev.farms || [])];
      updatedFarms[farmIndex].houses[houseIndex].flocks = updatedFarms[farmIndex].houses[houseIndex].flocks.filter((_, i) => i !== flockIndex);
      return { ...prev, farms: updatedFarms };
    });
  };

  const updateFlock = (farmIndex: number, houseIndex: number, flockIndex: number, field: string, value: any) => {
    setFormData(prev => {
      const updatedFarms = [...(prev.farms || [])];
      updatedFarms[farmIndex].houses[houseIndex].flocks[flockIndex] = { ...updatedFarms[farmIndex].houses[houseIndex].flocks[flockIndex], [field]: value };
      return { ...prev, farms: updatedFarms };
    });
  };

  const updateManager = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, manager: { ...prev.manager, [field]: value } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user?.id).single();

      const response = await fetch("/api/ceo/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, orgId: profile?.org_id }),
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || "Setup failed");

      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-sand-200">
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
                    <option value="internal">Internal</option>
                    <option value="external">External</option>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-forest-600">Farm Name</label>
                        <input
                          required
                          className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-600"
                          value={farm.name}
                          onChange={(e) => updateFarm(farmIndex, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-forest-600">Location</label>
                        <input
                          required
                          className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-600"
                          value={farm.location}
                          onChange={(e) => updateFarm(farmIndex, "location", e.target.value)}
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
                                        <label className="text-[9px] text-forest-500">Flock Type</label>
                                        <input
                                          required
                                          className="w-full rounded border border-sand-200 bg-white px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-forest-600"
                                          value={flock.type}
                                          onChange={(e) => updateFlock(farmIndex, houseIndex, flockIndex, "type", e.target.value)}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[9px] text-forest-500">Placement Weeks</label>
                                        <input
                                          required
                                          type="number"
                                          className="w-full rounded border border-sand-200 bg-white px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-forest-600"
                                          value={flock.age_at_placement_weeks}
                                          onChange={(e) => updateFlock(farmIndex, houseIndex, flockIndex, "age_at_placement_weeks", parseInt(e.target.value) || 0)}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[9px] text-forest-500">Template ID</label>
                                        <input
                                          required
                                          className="w-full rounded border border-sand-200 bg-white px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-forest-600"
                                          value={flock.template_id}
                                          onChange={(e) => updateFlock(farmIndex, houseIndex, flockIndex, "template_id", e.target.value)}
                                        />
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
                  </div>
                ))}
              </div>
            </section>

            {/* Manager Section */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-forest-800 border-b border-sand-200 pb-2">4. Farm Manager Credentials</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <label className="text-sm font-medium text-forest-700">Password</label>
                  <input
                    required
                    type="password"
                    className="w-full rounded-lg border border-sand-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-forest-600"
                    value={formData.manager?.password}
                    onChange={(e) => updateManager("password", e.target.value)}
                  />
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
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-2 bg-forest-900 text-sand-50 rounded-lg font-medium hover:bg-forest-800 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Initialize Branch Hierarchy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

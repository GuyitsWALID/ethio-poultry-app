"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Building2, MapPin, Trash2, Loader2, Plus, Search } from "lucide-react";
import { SetupModal } from "@/components/ceo/setup-modal";

export default function BranchListPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const supabase = createClient();

  const loadBranches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("name");

    if (!error) {
      setBranches(data || []);
      setFilteredBranches(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    const filtered = branches.filter(b =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.location.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredBranches(filtered);
  }, [searchQuery, branches]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-forest-700" />
          <h1 className="text-3 la-sm font-bold text-forest-900">Branch Network</h1>
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
      ) : filteredBranches.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-sand-300">
          <p className="text-forest-600">No branches found matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBranches.map((branch) => (
            <div key={branch.id} className="p-6 bg-white rounded-2xl border border-sand-200 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-forest-50 rounded-lg">
                  <Building2 className="h-6 w-6 text-forest-700" />
                </div>
                <button className="p-2 text-sand-300 hover:text-red-500 transition-colors">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              <h3 className="text-xl font-semibold text-forest-900 mb-1">{branch.name}</h3>
              <div className="flex items-center gap-2 text-sm text-forest-600">
                <Map la-sm className="h-4 w-4" />
                {branch.location}
              </div>
            </div>
          ))}
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

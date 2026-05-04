"use client";

import { useState } from "react";

export default function FarmsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-forest-500">
            Farms
          </p>
          <h2 className="text-2xl font-semibold text-forest-900">
            Farm directory
          </h2>
          <p className="mt-2 text-sm text-forest-600">
            Create new farms, assign houses, and track capacity.
          </p>
        </div>
        <button
          className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          New farm
        </button>
      </div>

      <div className="rounded-2xl border border-dashed border-sand-200 bg-white/70 p-10 text-center">
        <p className="text-sm font-semibold text-forest-900">No farms yet</p>
        <p className="mt-2 text-sm text-forest-600">
          Create your first farm to start tracking houses, flocks, and alerts.
        </p>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-forest-900">
                Create new farm
              </h3>
              <button
                className="text-sm text-forest-600"
                type="button"
                onClick={() => setIsModalOpen(false)}
              >
                Close
              </button>
            </div>
            <form className="mt-6 grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-forest-900" htmlFor="farm-name">
                  Farm name
                </label>
                <input
                  id="farm-name"
                  className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  placeholder="Addis Farm"
                  type="text"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-forest-900" htmlFor="farm-branch">
                  Branch
                </label>
                <input
                  id="farm-branch"
                  className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  placeholder="Addis Branch"
                  type="text"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-forest-900" htmlFor="farm-location">
                  Location
                </label>
                <input
                  id="farm-location"
                  className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  placeholder="Bishoftu, Ethiopia"
                  type="text"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-forest-900" htmlFor="farm-capacity">
                  Capacity (birds)
                </label>
                <input
                  id="farm-capacity"
                  className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  placeholder="15000"
                  type="number"
                />
              </div>
              <div className="mt-2 flex flex-wrap justify-end gap-3">
                <button
                  className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50"
                  type="submit"
                >
                  Save farm
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
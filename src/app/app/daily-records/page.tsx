"use client";

import { useState } from "react";

export default function DailyRecordsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-forest-500">
            Daily records
          </p>
          <h2 className="text-2xl font-semibold text-forest-900">
            Daily operations tracking
          </h2>
          <p className="mt-2 text-sm text-forest-600">
            Feed intake, mortality, egg collection, and water usage.
          </p>
        </div>
        <button
          className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          New record
        </button>
      </div>

      <div className="rounded-2xl border border-dashed border-sand-200 bg-white/70 p-10 text-center">
        <p className="text-sm font-semibold text-forest-900">No daily records yet</p>
        <p className="mt-2 text-sm text-forest-600">
          Add the first daily operation record for a flock.
        </p>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 px-4">
          <div className="h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-forest-900">
                New daily operation record
              </h3>
              <button
                className="text-sm text-forest-600"
                type="button"
                onClick={() => setIsModalOpen(false)}
              >
                Close
              </button>
            </div>
            <form className="mt-6 grid gap-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="record-date">
                    Record date
                  </label>
                  <input
                    id="record-date"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    type="date"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="flock-id">
                    Flock ID
                  </label>
                  <input
                    id="flock-id"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="LAY-2026-003"
                    type="text"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="farm">
                    Farm
                  </label>
                  <input
                    id="farm"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="Addis Farm"
                    type="text"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="house">
                    House
                  </label>
                  <input
                    id="house"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="House 2"
                    type="text"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="live-count">
                    Live count
                  </label>
                  <input
                    id="live-count"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="1240"
                    type="number"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="deaths">
                    Deaths
                  </label>
                  <input
                    id="deaths"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="12"
                    type="number"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="culls">
                    Culls
                  </label>
                  <input
                    id="culls"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="0"
                    type="number"
                  />
                </div>
                <div className="md:col-span-3 grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="death-cause">
                    Mortality cause
                  </label>
                  <input
                    id="death-cause"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="Respiratory disease"
                    type="text"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="feed-consumed">
                    Feed consumed (kg)
                  </label>
                  <input
                    id="feed-consumed"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="320"
                    type="number"
                    step="0.01"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="feed-type">
                    Feed type
                  </label>
                  <input
                    id="feed-type"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="Layer mash"
                    type="text"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="water">
                    Water consumed (liters)
                  </label>
                  <input
                    id="water"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="900"
                    type="number"
                    step="0.1"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="medication">
                    Medication administered
                  </label>
                  <input
                    id="medication"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="Vitamin supplement"
                    type="text"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="temperature">
                    Temperature (°C)
                  </label>
                  <input
                    id="temperature"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="26.5"
                    type="number"
                    step="0.1"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="humidity">
                    Humidity (%)
                  </label>
                  <input
                    id="humidity"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="62"
                    type="number"
                    step="0.1"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="weight-sample">
                    Weight sample count
                  </label>
                  <input
                    id="weight-sample"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="40"
                    type="number"
                  />
                </div>
                <div className="md:col-span-3 grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="avg-weight">
                    Average weight (g)
                  </label>
                  <input
                    id="avg-weight"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="980"
                    type="number"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-5">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="eggs-total">
                    Total eggs
                  </label>
                  <input
                    id="eggs-total"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="1200"
                    type="number"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="eggs-good">
                    Good eggs
                  </label>
                  <input
                    id="eggs-good"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="1150"
                    type="number"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="eggs-broken">
                    Broken eggs
                  </label>
                  <input
                    id="eggs-broken"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="18"
                    type="number"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="eggs-dirty">
                    Dirty eggs
                  </label>
                  <input
                    id="eggs-dirty"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="22"
                    type="number"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="eggs-floor">
                    Floor eggs
                  </label>
                  <input
                    id="eggs-floor"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="10"
                    type="number"
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
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
                  Save record
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
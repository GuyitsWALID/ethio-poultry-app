export default function FlocksPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-forest-500">
            Flocks
          </p>
          <h2 className="text-2xl font-semibold text-forest-900">
            Flock registry
          </h2>
          <p className="mt-2 text-sm text-forest-600">
            Track batches, locations, and flock KPIs.
          </p>
        </div>
        <button
          className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50"
          type="button"
        >
          New flock
        </button>
      </div>
    </div>
  );
}
export default function HouseOverview() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">
          House detail
        </p>
        <h2 className="text-2xl font-semibold text-forest-900">
          House performance and sensors
        </h2>
        <p className="mt-2 text-sm text-forest-600">
          Temperature and humidity alerts, flock activity, and daily status.
        </p>
      </div>
    </div>
  );
}
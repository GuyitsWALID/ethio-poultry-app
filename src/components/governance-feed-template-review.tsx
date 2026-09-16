type FeedTemplateRow = {
  week_number?: unknown;
  age_day_start?: unknown;
  age_day_end?: unknown;
  feed_intake_std_g_per_head?: unknown;
  feed_intake_recommended_g_per_head?: unknown;
  target_weight_min_g?: unknown;
  target_weight_max_g?: unknown;
  feed_type_plan?: unknown;
  light_on_time?: unknown;
  light_off_time?: unknown;
};

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function feedType(value: unknown) {
  return text(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function FeedTemplateReview({ rows }: { rows: unknown }) {
  if (!Array.isArray(rows)) return <p className="text-sm text-forest-600">No template rows were supplied.</p>;

  return <div className="overflow-x-auto rounded-xl border border-sand-200 bg-white">
    <table className="min-w-[1120px] w-full text-left text-xs">
      <caption className="border-b border-sand-200 bg-sand-50 px-3 py-2 text-left font-semibold text-forest-700">
        {rows.length} approved feed-plan row{rows.length === 1 ? "" : "s"}
      </caption>
      <thead className="bg-sand-50 uppercase tracking-wide text-forest-500"><tr>
        <th className="p-3">Week</th><th className="p-3">Age days</th><th className="p-3">Standard g/bird</th><th className="p-3">Recommended g/bird</th><th className="p-3">Target weight</th><th className="p-3">Feed type</th><th className="p-3">Lights on</th><th className="p-3">Lights off</th>
      </tr></thead>
      <tbody>{rows.map((item, index) => {
        const row = item && typeof item === "object" ? item as FeedTemplateRow : {};
        return <tr key={`${text(row.week_number)}-${index}`} className="border-t border-sand-100 text-forest-800">
          <td className="p-3 font-semibold">{text(row.week_number)}</td>
          <td className="p-3">{text(row.age_day_start)}–{text(row.age_day_end)}</td>
          <td className="p-3">{text(row.feed_intake_std_g_per_head)}</td>
          <td className="p-3 font-semibold">{text(row.feed_intake_recommended_g_per_head)}</td>
          <td className="p-3">{text(row.target_weight_min_g)}–{text(row.target_weight_max_g)} g</td>
          <td className="p-3">{feedType(row.feed_type_plan)}</td>
          <td className="p-3">{text(row.light_on_time)}</td>
          <td className="p-3">{text(row.light_off_time)}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

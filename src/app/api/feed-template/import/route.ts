type ExtractedRow = {
  week_number: number;
  age_day_start: number;
  age_day_end: number;
  feed_intake_std_g_per_head: number | null;
  feed_intake_recommended_g_per_head: number | null;
  target_weight_min_g: number | null;
  target_weight_max_g: number | null;
  feed_type_plan: string;
  light_on_time: string;
  light_off_time: string;
};

const expectedKeys = [
  "week_number",
  "age_day_start",
  "age_day_end",
  "feed_intake_std_g_per_head",
  "feed_intake_recommended_g_per_head",
  "target_weight_min_g",
  "target_weight_max_g",
  "feed_type_plan",
  "light_on_time",
  "light_off_time",
];

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTime(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!match) return raw;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(header: string) {
  const value = header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const aliases: Record<string, string> = {
    week: "week_number",
    wks: "week_number",
    weeks: "week_number",
    days_start: "age_day_start",
    day_start: "age_day_start",
    start_day: "age_day_start",
    days_end: "age_day_end",
    day_end: "age_day_end",
    end_day: "age_day_end",
    std: "feed_intake_std_g_per_head",
    feed_std: "feed_intake_std_g_per_head",
    feed_intake_std: "feed_intake_std_g_per_head",
    recommended: "feed_intake_recommended_g_per_head",
    feed_recommended: "feed_intake_recommended_g_per_head",
    body_weight_min: "target_weight_min_g",
    weight_min: "target_weight_min_g",
    body_weight_max: "target_weight_max_g",
    weight_max: "target_weight_max_g",
    type_of_feed: "feed_type_plan",
    feed_type: "feed_type_plan",
    lighting_on: "light_on_time",
    light_on: "light_on_time",
    lighting_off: "light_off_time",
    light_off: "light_off_time",
  };
  return aliases[value] ?? value;
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return normalizeRow(row);
  }).filter((row) => row.week_number > 0 || row.age_day_end > 0);
}

function normalizeRow(row: Record<string, unknown>): ExtractedRow {
  const week = numberOrNull(row.week_number) ?? 0;
  const start = numberOrNull(row.age_day_start) ?? 0;
  const end = numberOrNull(row.age_day_end) ?? start + 6;
  const min = numberOrNull(row.target_weight_min_g);
  const max = numberOrNull(row.target_weight_max_g);
  return {
    week_number: week,
    age_day_start: start,
    age_day_end: end,
    feed_intake_std_g_per_head: numberOrNull(row.feed_intake_std_g_per_head),
    feed_intake_recommended_g_per_head: numberOrNull(row.feed_intake_recommended_g_per_head),
    target_weight_min_g: min === null || max === null ? min : Math.min(min, max),
    target_weight_max_g: min === null || max === null ? max : Math.max(min, max),
    feed_type_plan: String(row.feed_type_plan ?? "").trim(),
    light_on_time: normalizeTime(row.light_on_time),
    light_off_time: normalizeTime(row.light_off_time),
  };
}

function extractJson(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) throw new Error("Vision model did not return JSON.");
    return JSON.parse(match[0]);
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Upload a feed template file." }, { status: 400 });
    }

    const contentType = file.type || "application/octet-stream";
    const name = file.name.toLowerCase();

    if (contentType.includes("csv") || contentType.includes("text") || name.endsWith(".csv") || name.endsWith(".txt")) {
      const rows = parseCsv(await file.text());
      return Response.json({ rows, notes: "CSV rows parsed. Review before saving." });
    }

    if (contentType.includes("pdf") || name.endsWith(".pdf")) {
      return Response.json(
        {
          rows: [],
          error: "PDF upload is accepted, but this build needs a PDF-to-image converter before local vision extraction can read it. Upload a screenshot/image or CSV for now.",
        },
        { status: 422 }
      );
    }

    if (!contentType.startsWith("image/")) {
      return Response.json({ error: "Unsupported file type. Use CSV, text, PDF, or image." }, { status: 415 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");
    const model = process.env.OLLAMA_VISION_MODEL ?? "llama3.2-vision";
    const ollamaUrl = process.env.OLLAMA_URL ?? "http://localhost:11434/api/generate";
    const prompt = [
      "Extract the poultry feed template table from this image.",
      "Return strict JSON only with this shape:",
      `{ "rows": [{ ${expectedKeys.map((key) => `"${key}": null`).join(", ")} }] }`,
      "Use grams for feed and body weight. Parse day ranges like 49-56 into age_day_start and age_day_end.",
      "For target weight ranges, put the lower value in target_weight_min_g and upper value in target_weight_max_g.",
      "If a cell is uncertain, set it to null or empty string. Do not invent rows.",
    ].join("\n");

    const response = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        images: [base64],
        stream: false,
        format: "json",
      }),
    });

    if (!response.ok) {
      return Response.json(
        { error: "Ollama vision extraction is unavailable. Start Ollama locally or enter the template manually." },
        { status: 503 }
      );
    }

    const result = await response.json();
    const parsed = extractJson(String(result.response ?? "{}"));
    const rows = (Array.isArray(parsed) ? parsed : parsed.rows ?? []).map((row: Record<string, unknown>) => normalizeRow(row));
    return Response.json({ rows, notes: "Vision extraction complete. Review every row before saving." });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Template import failed." },
      { status: 500 }
    );
  }
}

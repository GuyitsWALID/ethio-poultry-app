// Executes the reader's PostgREST predicates, including nested scope/cursor ORs.
const split = value => {
  const parts = []; let depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    if (value[i] === ")") depth--;
    if (value[i] === "," && depth === 0) {parts.push(value.slice(start, i)); start = i + 1;}
  }
  parts.push(value.slice(start)); return parts;
};
const compare = (row, field, op, value) => {
  const actual = row[field] ?? null;
  if (op === "is") return value === "null" || value === null ? actual === null : actual === value;
  if (op === "eq") return actual === value;
  if (op === "in") return (Array.isArray(value) ? value : split(value.slice(1, -1))).includes(actual);
  if (op === "like") return typeof actual === "string" && new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("%", ".*").replaceAll("_", ".")}$`).test(actual);
  if (actual === null) return false;
  if (op === "lt") return actual < value;
  if (op === "lte") return actual <= value;
  if (op === "gt") return actual > value;
  if (op === "gte") return actual >= value;
  throw Error(`Unknown predicate ${op}`);
};
function expression(row, value) {
  if (value.startsWith("and(")) return split(value.slice(4, -1)).every(term => expression(row, term));
  if (value.startsWith("or(")) return split(value.slice(3, -1)).some(term => expression(row, term));
  const [, field, op, raw] = /^([^.]+)\.([^.]+)\.(.*)$/.exec(value) ?? [];
  if (!field) throw Error(`Malformed predicate ${value}`);
  if (op === "not") {const i = raw.indexOf("."); return row[field] != null && !compare(row, field, raw.slice(0, i), raw.slice(i+1));}
  return compare(row, field, op, ["gt", "gte", "lt", "lte"].includes(op) && /^\d+$/.test(raw) ? Number(raw) : raw);
}
export function historyDb(tables) {
  const calls = [];
  return {calls, from(table) {
    const predicates = [], ordering = []; let columns = "*", start = 0, count = Infinity, single = false;
    const call = {table, predicates, ordering, get count() {return count;}}; calls.push(call);
    const query = {
      select(value) {columns = value; return query;},
      eq(field, value) {predicates.push(row => compare(row, field, "eq", value)); return query;},
      is(field, value) {predicates.push(row => compare(row, field, "is", value)); return query;},
      in(field, value) {predicates.push(row => compare(row, field, "in", value)); return query;},
      lt(field, value) {predicates.push(row => compare(row, field, "lt", value)); return query;},
      lte(field, value) {predicates.push(row => compare(row, field, "lte", value)); return query;},
      gte(field, value) {predicates.push(row => compare(row, field, "gte", value)); return query;},
      like(field, value) {predicates.push(row => compare(row, field, "like", value)); return query;},
      not(field, op, value) {predicates.push(row => op === "is" ? !compare(row, field, op, value) : row[field] != null && !compare(row, field, op, value)); return query;},
      or(value) {predicates.push(row => split(value).some(term => expression(row, term))); return query;},
      order(field, options = {}) {ordering.push({field, ascending: options.ascending !== false}); return query;},
      range(from, to) {start = from; count = to - from + 1; return query;},
      limit(value) {count = value; return query;},
      maybeSingle() {single = true; return query;},
      then(resolve, reject) {
        try {
          if (!Object.hasOwn(tables, table)) throw Error(`Missing fixture table ${table}`);
          if (tables[table] instanceof Error) return Promise.resolve({data: null, error: tables[table]}).then(resolve, reject);
          const rows = tables[table].filter(row => predicates.every(predicate => predicate(row))).sort((a, b) => {
            for (const {field, ascending} of ordering) if (a[field] !== b[field]) return (a[field] > b[field] ? 1 : -1) * (ascending ? 1 : -1);
            return 0;
          }).slice(start, start + count).map(row => columns === "*" ? row : Object.fromEntries(columns.split(",").map(key => [key, row[key] ?? null])));
          return Promise.resolve({data: single ? rows[0] ?? null : rows, error: null}).then(resolve, reject);
        } catch (error) {return Promise.reject(error).then(resolve, reject);}
      },
    };
    return query;
  }};
}

export function parseNetflixCsv(content: string) {
  const rows = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (rows.length < 2) throw new Error("Die CSV-Datei enthält keine Einträge.");
  const parse = (row: string) => {
    const result: string[] = []; let value = ""; let quoted = false;
    for (let i = 0; i < row.length; i += 1) {
      if (row[i] === '"' && quoted && row[i + 1] === '"') { value += '"'; i += 1; }
      else if (row[i] === '"') quoted = !quoted;
      else if (row[i] === "," && !quoted) { result.push(value.trim()); value = ""; }
      else value += row[i];
    }
    result.push(value.trim()); return result;
  };
  const headers = parse(rows[0]).map((value) => value.toLowerCase());
  const title = headers.indexOf("title"); const date = headers.indexOf("date");
  if (title < 0 || date < 0) throw new Error('Spalten "Title" und "Date" fehlen.');
  return rows.slice(1).map(parse).filter((row) => row[title] && row[date]).slice(0, 50)
    .map((row) => ({ title: row[title].split(":")[0].trim(), date: row[date] }));
}

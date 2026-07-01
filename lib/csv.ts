export type CsvWatch = { rawTitle: string; parsedTitle: string; watchDate: string };

function parseRow(row: string) {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === '"' && quoted && row[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else value += char;
  }
  cells.push(value.trim());
  return cells;
}

function toIsoDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export function parseNetflixCsv(content: string, limit = 50): CsvWatch[] {
  const rows = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (rows.length < 2) throw new Error('Die CSV-Datei enthält keine Wiedergabeeinträge.');
  const headers = parseRow(rows[0]).map((cell) => cell.toLowerCase());
  const titleIndex = headers.indexOf('title');
  const dateIndex = headers.indexOf('date');
  if (titleIndex < 0 || dateIndex < 0) throw new Error('Erwartete Spalten „Title“ und „Date“ fehlen.');

  return rows.slice(1)
    .map(parseRow)
    .filter((cells) => cells[titleIndex] && cells[dateIndex])
    .map((cells) => ({
      rawTitle: cells[titleIndex],
      parsedTitle: cells[titleIndex].split(':')[0].trim(),
      watchDate: toIsoDate(cells[dateIndex]),
    }))
    .sort((a, b) => new Date(b.watchDate).getTime() - new Date(a.watchDate).getTime())
    .slice(0, limit);
}

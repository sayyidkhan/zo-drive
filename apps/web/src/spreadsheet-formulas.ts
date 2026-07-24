export function formulaDisplay(value: string, cells: Record<string, string>): string {
  if (!value.startsWith("=")) return value;
  try {
    const result = evaluateFormula(value.slice(1), cells, new Set());
    return Number.isInteger(result) ? String(result) : String(Math.round(result * 1_000_000) / 1_000_000);
  } catch {
    return "#ERROR";
  }
}

function evaluateFormula(expression: string, cells: Record<string, string>, visited: Set<string>): number {
  const withSums = expression.replace(
    /SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/gi,
    (_match, first: string, last: string) => String(sumRange(first.toUpperCase(), last.toUpperCase(), cells, visited))
  );
  const substituted = withSums.replace(
    /\b([A-Z]+\d+)\b/gi,
    (_match, reference: string) => String(cellNumber(reference.toUpperCase(), cells, visited))
  );
  if (!/^[0-9+\-*/().\s]+$/.test(substituted)) throw new Error("Unsupported formula");
  const result = Function(`"use strict"; return (${substituted});`)();
  if (typeof result !== "number" || !Number.isFinite(result)) throw new Error("Invalid result");
  return result;
}

function cellNumber(reference: string, cells: Record<string, string>, visited: Set<string>): number {
  if (visited.has(reference)) throw new Error("Circular reference");
  const value = cells[reference] ?? "0";
  if (!value.startsWith("=")) return Number(value) || 0;
  const nextVisited = new Set(visited);
  nextVisited.add(reference);
  return evaluateFormula(value.slice(1), cells, nextVisited);
}

function sumRange(first: string, last: string, cells: Record<string, string>, visited: Set<string>): number {
  const start = parseCellReference(first);
  const end = parseCellReference(last);
  if (!start || !end || start.column > end.column || start.row > end.row) throw new Error("Invalid range");
  let total = 0;
  for (let column = start.column; column <= end.column; column += 1) {
    for (let row = start.row; row <= end.row; row += 1) {
      total += cellNumber(`${columnName(column)}${row}`, cells, visited);
    }
  }
  return total;
}

function parseCellReference(value: string): { column: number; row: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(value);
  if (!match) return null;
  const column = [...match[1]!].reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0);
  return { column, row: Number(match[2]) };
}

function columnName(column: number): string {
  let result = "";
  for (let current = column; current > 0; current = Math.floor((current - 1) / 26)) {
    result = String.fromCharCode(65 + ((current - 1) % 26)) + result;
  }
  return result;
}

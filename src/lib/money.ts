/** All money is stored as whole pence. Format it for display, e.g. 795 -> "£7.95". */
export function formatPence(pence: number): string {
  if (!Number.isInteger(pence)) {
    throw new Error(`Money must be whole pence, got ${pence}`);
  }
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(pence);
  return `${sign}£${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

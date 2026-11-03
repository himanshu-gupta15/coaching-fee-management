/** All amounts are integer paise. Formatting helpers for receipts/CSV only. */
export function assertPaise(n: number): number {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Amount must be a non-negative integer in paise');
  return n;
}

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return `Rs. ${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function paiseToRupeeString(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

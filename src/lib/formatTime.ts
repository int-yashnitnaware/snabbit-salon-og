/** Formats a timestamptz ISO string as IST time with AM/PM, e.g. "7:24 AM". */
export function formatTimeIST(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

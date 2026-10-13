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

/** Formats a plain "HH:MM:SS" time-of-day (no timezone, already local) with AM/PM, e.g. "9:00 AM". */
export function formatPlainTime(time: string | null): string {
  if (!time) return '—'
  const [hoursStr, minutesStr] = time.split(':')
  const hours = Number(hoursStr)
  const minutes = Number(minutesStr)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

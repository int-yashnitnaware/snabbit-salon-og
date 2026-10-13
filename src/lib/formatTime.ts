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

/** Formats a shift as "9:00 AM - 9:00 PM" from a start time + duration (wraps past midnight). */
export function formatShiftRange(startTime: string | null, hrs: number | null): string {
  if (!startTime) return '—'
  const start = formatPlainTime(startTime)
  if (hrs == null) return start
  const [h, m] = startTime.split(':').map(Number)
  const endTotalMinutes = (h * 60 + m + hrs * 60) % (24 * 60)
  const endHours = Math.floor(endTotalMinutes / 60)
  const endMinutes = endTotalMinutes % 60
  const end = formatPlainTime(`${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:00`)
  return `${start} - ${end}`
}

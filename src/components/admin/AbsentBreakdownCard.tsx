import type { AttendanceSummary } from '@/lib/attendance-summary'

const LABELS: Record<keyof AttendanceSummary['breakdown'], string> = {
  marked_absent: 'Marked',
  no_show: 'No Show',
  not_marked: 'Not Marked',
  false_attendance: 'False Attendance',
  on_leave: 'On leave',
}

export default function AbsentBreakdownCard({
  summary,
}: {
  summary: AttendanceSummary
}) {
  return (
    <div className="bg-danger text-white rounded-3xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-lg">Absent</span>
        <span className="font-bold text-2xl">{summary.absent}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {(
          Object.keys(summary.breakdown) as (keyof AttendanceSummary['breakdown'])[]
        ).map((key) => (
          <div key={key} className="flex justify-between">
            <span>{LABELS[key]}:</span>
            <span className="font-semibold">
              {String(summary.breakdown[key]).padStart(2, '0')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

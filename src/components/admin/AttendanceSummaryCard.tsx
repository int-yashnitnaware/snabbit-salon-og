import type { AttendanceSummary } from '@/lib/attendance-summary'

export default function AttendanceSummaryCard({
  summary,
}: {
  summary: AttendanceSummary
}) {
  return (
    <div className="bg-brand text-white rounded-3xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-lg">Attendance</span>
        <span className="font-bold text-2xl">{summary.totalExpected}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Present:</span>
        <span className="font-semibold">{summary.present}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Absent:</span>
        <span className="font-semibold">{summary.absent}</span>
      </div>
    </div>
  )
}

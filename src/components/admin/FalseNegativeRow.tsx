export default function FalseNegativeRow({ count }: { count: number }) {
  return (
    <div className="bg-success text-white rounded-2xl shadow p-4 flex justify-between items-center">
      <span className="font-semibold">False Negative:</span>
      <span className="font-bold text-xl">{String(count).padStart(2, '0')}</span>
    </div>
  )
}

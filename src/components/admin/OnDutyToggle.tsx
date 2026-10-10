'use client'

import { useState } from 'react'

export default function OnDutyToggle({
  initialOnDuty,
}: {
  initialOnDuty: boolean
}) {
  const [onDuty, setOnDuty] = useState(initialOnDuty)

  return (
    <button
      onClick={() => setOnDuty(!onDuty)}
      className={`rounded-full px-3 py-1 text-sm font-semibold ${
        onDuty ? 'bg-success text-white' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {onDuty ? 'Online' : 'Offline'}
    </button>
  )
}

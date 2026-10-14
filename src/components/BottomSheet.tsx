'use client'

interface BottomSheetProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function BottomSheet({ title, onClose, children, footer }: BottomSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[80vh] bg-white rounded-t-3xl shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 text-2xl leading-none px-1">
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-1">{children}</div>
        {footer && <div className="flex gap-3 p-4 border-t border-gray-100 shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

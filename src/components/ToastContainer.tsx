import { X } from 'lucide-react'
import { useToast } from '../hooks/useToast'

export function ToastContainer() {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-3 rounded-lg border border-cyan/30 bg-navy-light px-4 py-3 shadow-lg"
          style={{ borderColor: 'rgba(0, 212, 255, 0.3)', backgroundColor: '#111827' }}
        >
          <span className="text-sm text-white">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="text-slate-400 hover:text-cyan"
            style={{ color: undefined }}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}

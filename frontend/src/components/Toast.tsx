import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext<(message: string) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current)
    setMessage(msg)
    timer.current = setTimeout(() => setMessage(null), 3400)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <div
          style={{
            position: 'fixed',
            bottom: 26,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#241A21',
            color: '#ffffff',
            padding: '13px 22px',
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 14,
            boxShadow: '0 10px 30px rgba(36,26,33,0.3)',
            zIndex: 100,
            animation: 'toastIn .25s ease',
            whiteSpace: 'nowrap',
            maxWidth: '90vw',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

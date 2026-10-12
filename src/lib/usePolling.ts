'use client'

import { useEffect, useRef } from 'react'

/** Calls `callback` immediately is left to the caller; this only sets up the
 * repeating timer, so the first load can show a spinner while refreshes stay silent. */
export function usePolling(callback: () => void, intervalMs: number) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const id = setInterval(() => callbackRef.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}

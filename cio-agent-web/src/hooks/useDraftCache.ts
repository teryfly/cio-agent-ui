import { useState, useCallback, useMemo, useRef } from 'react'
import { debounce } from 'lodash'

const DEBOUNCE_MS = 500

export function useDraftCache(key: string) {
  // Capture restoration state ONCE at mount time
  const wasRestoredRef = useRef<boolean>(
    typeof localStorage !== 'undefined' && !!localStorage.getItem(key)
  )
  const isRestored = wasRestoredRef.current

  const [draft, setDraft] = useState<string>(() => {
    try {
      return localStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  })

  const saveDraft = useMemo(
    () =>
      debounce((text: string) => {
        try {
          if (text.trim()) {
            localStorage.setItem(key, text)
          } else {
            localStorage.removeItem(key)
          }
        } catch {
          // localStorage might be full or unavailable
        }
      }, DEBOUNCE_MS),
    [key]
  )

  const updateDraft = useCallback(
    (text: string) => {
      setDraft(text)
      saveDraft(text)
    },
    [saveDraft]
  )

  const clearDraft = useCallback(() => {
    setDraft('')
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
    saveDraft.cancel()
    // Mark as no longer restored after first clear
    wasRestoredRef.current = false
  }, [key, saveDraft])

  return { draft, updateDraft, clearDraft, isRestored }
}

import { useState, useCallback } from 'react'

const STORAGE_KEY = 'pb-onboarding-done'

export function useOnboarding() {
  const [active, setActive]   = useState(() => {
    try { return !localStorage.getItem(STORAGE_KEY) } catch { return false }
  })
  const [step, setStep] = useState(0)

  const start = useCallback(() => {
    setStep(0)
    setActive(true)
  }, [])

  const next = useCallback((total) => {
    setStep(s => {
      if (s + 1 >= total) {
        try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
        setActive(false)
        return 0
      }
      return s + 1
    })
  }, [])

  const skip = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setActive(false)
    setStep(0)
  }, [])

  return { active, step, start, next, skip }
}

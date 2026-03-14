import { useEffect, useRef, useState } from 'react'
import Logo from './Logo'

const FADE_DURATION = 550  // ms — must match CSS transition on .preloader
const TIMEOUT_MS    = 8000 // max wait before force-revealing regardless of load state

// Asset-gated preloader.
//
// Trigger logic (first one wins — doneRef prevents double-fire):
//
//   loaded >= total  ──────────────────────┐
//                                          ▼
//   8s timeout  ──────────────────►  doFade() → setFading(true)
//                                          │
//                                    FADE_DURATION ms later
//                                          │
//                                          ▼
//                                      onDone()
//
export default function Preloader({ loaded, total, onDone }) {
  const [fading, setFading] = useState(false)
  const doneRef = useRef(false)

  const doFade = useRef(() => {
    if (doneRef.current) return
    doneRef.current = true
    setFading(true)
    setTimeout(onDone, FADE_DURATION)
  })

  // Trigger when all assets have reported in
  useEffect(() => {
    if (total > 0 && loaded >= total) doFade.current()
  }, [loaded, total])

  // 8s fallback — never trap the user
  useEffect(() => {
    const t = setTimeout(() => doFade.current(), TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`preloader ${fading ? 'preloader--fade' : ''}`}>
      <div className="preloader-spinner-wrap">
        <div className="preloader-spinner" />
        <Logo className="preloader-logo" />
      </div>
      {total > 0 && (
        <span className="preloader-count">{loaded} / {total}</span>
      )}
    </div>
  )
}

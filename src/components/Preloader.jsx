import { useEffect, useState } from 'react'
import Logo from './Logo'

export default function Preloader({ onDone }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1300)
    const t2 = setTimeout(onDone, 1800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div className={`preloader ${fading ? 'preloader--fade' : ''}`}>
      <div className="preloader-spinner-wrap">
        <div className="preloader-spinner" />
        <Logo className="preloader-logo" />
      </div>
    </div>
  )
}

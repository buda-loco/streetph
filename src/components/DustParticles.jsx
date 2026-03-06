import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function DustParticles() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const spawn = () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     0.4 + Math.random() * 1.2,
      vx:    (Math.random() - 0.5) * 0.08,
      vy:    -(0.04 + Math.random() * 0.06),   // very slow upward drift
      alpha: 0.04 + Math.random() * 0.10,
      wave:  Math.random() * Math.PI * 2,
      waveAmp: 0.05 + Math.random() * 0.08,
    })

    const particles = Array.from({ length: 120 }, () => {
      const p = spawn()
      p.y = Math.random() * canvas.height   // seed across full height
      return p
    })

    let animId
    let t = 0
    const tick = () => {
      if (document.hidden) { animId = null; return }
      animId = requestAnimationFrame(tick)
      t += 0.008
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx + Math.sin(t + p.wave) * p.waveAmp
        p.y += p.vy

        // Wrap around edges
        if (p.y < -4)              { p.y = canvas.height + 4; p.x = Math.random() * canvas.width }
        if (p.x < -4)              p.x = canvas.width + 4
        if (p.x > canvas.width + 4) p.x = -4

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 200, 200, ${p.alpha})`
        ctx.fill()
      }
    }
    const onVisibility = () => { if (!document.hidden && !animId) tick() }
    document.addEventListener('visibilitychange', onVisibility)
    tick()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return createPortal(
    <canvas
      ref={canvasRef}
      style={{
        position:      'fixed',
        inset:         0,
        width:         '100%',
        height:        '100%',
        zIndex:        5,
        pointerEvents: 'none',
      }}
    />,
    document.body
  )
}

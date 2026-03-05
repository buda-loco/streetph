import { useEffect, useRef } from 'react'

export default function CoffeeCup() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const W = 100
    const H = 160
    canvas.width  = W
    canvas.height = H

    const particles = []

    const spawn = () => ({
      x:     W * 0.5 + (Math.random() - 0.5) * 16,
      y:     H * 0.68,
      vx:    (Math.random() - 0.5) * 0.25,
      vy:    -(0.55 + Math.random() * 0.35),
      size:  2.5 + Math.random() * 3,
      alpha: 0.45 + Math.random() * 0.25,
      decay: 0.006 + Math.random() * 0.004,
    })

    // Stagger initial particles so they don't all appear at once
    for (let i = 0; i < 10; i++) {
      const p = spawn()
      p.y    -= Math.random() * 70
      p.alpha *= Math.random()
      particles.push(p)
    }

    let animId
    const tick = () => {
      animId = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, W, H)

      if (Math.random() < 0.12) particles.push(spawn())

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        // Wispy sine drift
        p.x     += p.vx + Math.sin(p.y * 0.07 + i) * 0.18
        p.y     += p.vy
        p.size  += 0.04
        p.alpha -= p.decay

        if (p.alpha <= 0) { particles.splice(i, 1); continue }

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
        g.addColorStop(0, `rgba(230, 210, 185, ${p.alpha})`)
        g.addColorStop(1, `rgba(230, 210, 185, 0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    tick()

    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div className="coffee-corner">
      <canvas ref={canvasRef} className="steam-canvas" />
      <div className="coffee-cup-art">
        <div className="cup-body">
          <div className="cup-liquid" />
        </div>
        <div className="cup-handle" />
        <div className="cup-saucer" />
      </div>
    </div>
  )
}

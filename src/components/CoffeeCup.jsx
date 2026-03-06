import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { computeTableLayout, COFFEE_IN_CUP, CUP_TARGET, NAV_H } from '../lib/tableLayout.js'

export default function CoffeeCup() {
  const steamRef = useRef(null)
  const [pos, setPos] = useState(null)

  useEffect(() => {
    const calc = () => setPos(computeTableLayout())
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  // Steam particle system — age-based lifecycle for realistic hot-water vapor
  useEffect(() => {
    if (!pos || !steamRef.current) return
    const canvas = steamRef.current
    const ctx    = canvas.getContext('2d')
    const W = canvas.width  = Math.round(pos.coffee.width * 2.8)
    const H = canvas.height = Math.round(pos.coffee.height * 6)
    const cx = W / 2

    // Physical params (research-backed):
    //   Rise: 0.35–0.5 px/frame ≈ 10 cm/s at screen scale
    //   Lifetime: 150–270 frames (2.5–4.5s at 60fps)
    //   Alpha curve: fade-in first 15%, hold to 60%, fade-out last 40%
    //   Peak alpha: 0.08–0.14 — very translucent (hot vapor, not smoke)
    const spawn = () => {
      const spawnR  = 4 + Math.random() * 4
      const maxAge  = 150 + Math.random() * 120
      return {
        x:         cx + (Math.random() - 0.5) * pos.coffee.width * 0.24,
        y:         H,
        vx:        (Math.random() - 0.5) * 0.04,
        vy:        -(0.35 + Math.random() * 0.15),
        spawnR,
        r:         spawnR,
        age:       0,
        maxAge,
        peakAlpha: 0.08 + Math.random() * 0.06,
        wave:      Math.random() * Math.PI * 2,
        waveFreq:  0.25 + Math.random() * 0.20,
        waveAmp:   0.50 + Math.random() * 0.70,
      }
    }

    const spawnBubble = () => ({
      x:        cx + (Math.random() - 0.5) * pos.coffee.width * 0.38,
      y:        H,
      r:        0,
      maxR:     2 + Math.random() * 4,
      alpha:    0.55 + Math.random() * 0.3,
      speed:    0.12 + Math.random() * 0.15,
      popped:   false,
      popAlpha: 0,
    })

    const particles = []
    const bubbles   = []
    let nextBubble  = 60 + Math.random() * 120

    // Seed initial particles spread across the canvas height
    for (let i = 0; i < 14; i++) {
      const p = spawn()
      p.y    -= Math.random() * H * 0.88
      // Give them a random age proportional to how far they've already risen
      const frac = 1 - p.y / H
      p.age = Math.floor(frac * p.maxAge * 0.6)
      particles.push(p)
    }

    let animId, t = 0
    const tick = () => {
      if (document.hidden) { animId = null; return }
      animId = requestAnimationFrame(tick)
      t += 0.016   // wave oscillation timer — full real-time pace
      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'

      // Spawn ~3-4 new particles per second at 60fps (0.06/frame)
      if (Math.random() < 0.06) particles.push(spawn())

      // Bubble timer
      nextBubble--
      if (nextBubble <= 0) {
        bubbles.push(spawnBubble())
        nextBubble = 55 + Math.random() * 130
      }

      // Draw steam puffs
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.age++
        if (p.age >= p.maxAge) { particles.splice(i, 1); continue }

        const ageRatio = p.age / p.maxAge
        // Non-linear alpha curve: fade-in (0→15%), hold (15→60%), fade-out (60→100%)
        const fadeIn  = Math.min(ageRatio / 0.15, 1.0)
        const fadeOut = 1.0 - Math.max((ageRatio - 0.60) / 0.40, 0)
        const alpha   = fadeIn * fadeOut * p.peakAlpha

        if (alpha <= 0.002) continue

        // Particle grows as it rises
        p.r = p.spawnR * (1 + ageRatio * 2.4)

        // Gentle deceleration as convective plume slows
        p.vy *= 0.9985

        // Dual sine-wave lateral drift — wispy helical motion
        p.x += p.vx
             + Math.sin(t * p.waveFreq        + p.wave)        * p.waveAmp
             + Math.sin(t * p.waveFreq * 1.73 + p.wave + 1.2)  * (p.waveAmp * 0.3)
        p.y += p.vy

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
        g.addColorStop(0,   `rgba(240, 240, 240, ${alpha})`)
        g.addColorStop(0.4, `rgba(220, 220, 220, ${alpha * 0.30})`)
        g.addColorStop(1,   `rgba(200, 200, 200, 0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Draw bubbles
      ctx.globalCompositeOperation = 'source-over'
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]
        if (!b.popped) {
          b.r += b.speed
          if (b.r >= b.maxR) { b.popped = true; b.popAlpha = b.alpha }
        } else {
          b.popAlpha -= 0.06
          if (b.popAlpha <= 0) { bubbles.splice(i, 1); continue }
        }
        const a = b.popped ? b.popAlpha : b.alpha * (b.r / b.maxR)
        ctx.strokeStyle = `rgba(220, 220, 220, ${a})`
        ctx.lineWidth   = 0.8
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = `rgba(220, 220, 220, ${a * 0.5})`
        ctx.beginPath()
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    const onVisibility = () => { if (!document.hidden && !animId) tick() }
    document.addEventListener('visibilitychange', onVisibility)
    tick()
    return () => {
      cancelAnimationFrame(animId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [pos])

  if (!pos) return null

  const coffeeCenterX = pos.tableW * CUP_TARGET.x
  const coffeeCenterY = pos.tableH * CUP_TARGET.y

  const coffeeLeft = Math.round(coffeeCenterX - pos.coffee.width  / 2)
  const coffeeTop  = Math.round(coffeeCenterY - pos.coffee.height / 2)

  const cupLeft = Math.round(coffeeCenterX - COFFEE_IN_CUP.x * pos.cup.width)
  const cupTop  = Math.round(coffeeCenterY - COFFEE_IN_CUP.y * pos.cup.height)

  const steamW = Math.round(pos.coffee.width  * 2.8)
  const steamH = Math.round(pos.coffee.height * 6)
  const steamLeft = Math.round(coffeeCenterX - steamW / 2)
  // position: fixed — steam canvas bottom anchored to coffee liquid CENTER in viewport
  // coffeeCenterY is relative to gallery-page (which starts at NAV_H below viewport top)
  const steamTopFixed = Math.round(NAV_H + coffeeCenterY - steamH)

  return (
    <>
      {/* SVG filter for organic steam displacement — defined in-page, accessible to portaled canvas */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="steam-filter" x="-60%" y="-120%" width="220%" height="340%">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.009 0.045"
              numOctaves="5"
              seed="7"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                values="0.009 0.045;0.011 0.055;0.008 0.042;0.010 0.050;0.009 0.045"
                dur="14s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="18"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feGaussianBlur in="displaced" stdDeviation="7" />
          </filter>
        </defs>
      </svg>

      {/* Cup + coffee images */}
      <div className="coffee-scene" style={{ position: 'absolute', inset: 0, zIndex: 1000, pointerEvents: 'none' }}>
        <img
          src="/table/coffee.png"
          alt=""
          className="coffee-liquid"
          style={{
            position: 'absolute',
            left:   coffeeLeft,
            top:    coffeeTop,
            width:  pos.coffee.width,
            height: pos.coffee.height,
          }}
        />
        <img
          src="/table/coffeecup.png"
          alt="Coffee cup"
          style={{
            position: 'absolute',
            left:   cupLeft,
            top:    cupTop,
            width:  pos.cup.width,
            height: pos.cup.height,
          }}
        />
      </div>

      {/* Steam canvas portaled directly to body — above every stacking context */}
      {createPortal(
        <canvas
          ref={steamRef}
          style={{
            position:      'fixed',
            left:          steamLeft,
            top:           steamTopFixed,
            width:         steamW,
            height:        steamH,
            zIndex:        99999,
            pointerEvents: 'none',
            filter:        'url(#steam-filter)',
          }}
        />,
        document.body
      )}
    </>
  )
}

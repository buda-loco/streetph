import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { gsap } from 'gsap'

import PolaroidCard    from '../components/PolaroidCard.jsx'
import FilterBar       from '../components/FilterBar.jsx'
import Lightbox        from '../components/Lightbox.jsx'
import CoffeeCup       from '../components/CoffeeCup.jsx'
import Drawer          from '../components/Drawer.jsx'
import DustParticles   from '../components/DustParticles.jsx'
import BioText         from '../components/BioText.jsx'
import { getAllTags } from '../lib/photos.js'
import { TableScene } from '../gl/TableScene.js'
import { CUP_TARGET } from '../lib/tableLayout.js'

// ── Constants ────────────────────────────────────────────────────────
const BATCH = 9

// Zones keep cards spread but overlapping looks natural — like a real table
// Right/bottom bounds kept well clear of the coffee cup plate area
const X_ZONES = [[6, 32], [24, 50], [40, 60]]
const Y_ZONES = [[22, 38], [34, 54], [42, 62]]

// Exclusion zone centred on the visible saucer plate (not the coffee liquid centre).
// Radius is inflated to account for card body size so no card edge overlaps the ring.
// ── Tune these if the cup plate moves: cx/cy are % of the scatter-table, r is radius %
const CUP_EXCLUSION = { cx: 83, cy: 75, r: 36 }

// ── Helpers ──────────────────────────────────────────────────────────
function seededRng(seed) {
  let s = Math.abs(seed) | 1
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s ^= s >>> 16
    return (s >>> 0) / 0xffffffff
  }
}

function makeBatch(photos, seed) {
  if (!photos.length) return []
  const count = Math.min(BATCH, photos.length)
  const rng = seededRng(seed * 4049 + 7)
  // Fisher-Yates shuffle of the remaining photos so every card is unique
  const pool = photos.slice(1)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return [photos[0], ...pool.slice(0, count - 1)]  // latest always first
}

function computeScatter(count, seed, exclusion = null) {
  const rng = seededRng(seed * 6271 + 99)
  const MIN_CARD_DIST = 15   // % — prevents full overlap

  const positions = Array.from({ length: count }, (_, i) => {
    const col = i % 3
    const row = Math.min(Math.floor(i / 3), Y_ZONES.length - 1)
    const [xMin, xMax] = X_ZONES[col]
    const [yMin, yMax] = Y_ZONES[row]

    let x, y, tries = 0
    do {
      x = xMin + rng() * (xMax - xMin)
      y = yMin + rng() * (yMax - yMin)
      tries++
    } while (
      exclusion && tries < 30 &&
      Math.hypot(x - exclusion.cx, y - exclusion.cy) < exclusion.r
    )

    return {
      x,
      y,
      rotation: (rng() - 0.5) * 26,
      zIndex:   Math.floor(rng() * 20) + 1,
    }
  })

  // Separation pass: push overlapping cards apart (skip sleeper at last index)
  for (let iter = 0; iter < 5; iter++) {
    for (let i = 0; i < positions.length - 1; i++) {
      for (let j = i + 1; j < positions.length - 1; j++) {
        const dx = positions[j].x - positions[i].x
        const dy = positions[j].y - positions[i].y
        const d  = Math.hypot(dx, dy)
        if (d < MIN_CARD_DIST && d > 0.01) {
          const push = (MIN_CARD_DIST - d) / 2
          const nx = dx / d, ny = dy / d
          positions[i].x -= nx * push;  positions[i].y -= ny * push
          positions[j].x += nx * push;  positions[j].y += ny * push
        }
      }
    }
  }

  return positions
}

// ── Component ─────────────────────────────────────────────────────────
//
// Asset loading coordination:
//
//   image loads (9×)           wood.png (1×)
//        │                          │
//        ▼                          ▼
//   onCardLoaded(i)      TableScene({ onReady: onAssetLoaded })
//        │
//   loadedSetRef guards against double-count (cached img fires both
//   useEffect+onLoad paths in PolaroidCard)
//        │
//   onAssetLoaded() → App loadedCount++ → Preloader counter
//        │
//   if !ready: leave in pendingAnimRef (GSAP deferred)
//   if  ready: fire GSAP immediately
//
//   readyRef lets onCardLoaded read current `ready` without making
//   it a useCallback dependency — prevents re-rendering all 9 memoized
//   PolaroidCards when the preloader fades.
//
export default function Gallery({ photos, onAssetLoaded, ready }) {
  const canvasRef      = useRef(null)
  const cardRefs       = useRef([])
  const shadowRafRef   = useRef(null)
  const lightMouse     = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const lightTarget    = useRef({ ...lightMouse.current })
  const topZRef        = useRef(30)
  const pendingAnimRef = useRef({})   // i → { el, delay } — triggered on image load
  const readyRef       = useRef(ready)   // read in onCardLoaded without re-creating it
  const loadedSetRef   = useRef(new Set()) // dedup: prevent double-counting cached imgs

  const [activeTag,     setActiveTag]     = useState(null)
  const [shuffleKey,    setShuffleKey]    = useState(0)
  const [isShuffling,   setIsShuffling]   = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState(null)
  const [drawerOpen,    setDrawerOpen]    = useState(false)
  const [bioVisible,    setBioVisible]    = useState(false)
  // Sleeper Polaroid peeks out from under the cup's top-left side
  const sleeperPos = { x: CUP_TARGET.x * 100 - 8, y: CUP_TARGET.y * 100 - 9 }

  const tags   = useMemo(() => getAllTags(photos), [photos])
  const batch  = useMemo(() => makeBatch(photos, shuffleKey), [photos, shuffleKey])
  const layout = useMemo(
    () => computeScatter(batch.length, shuffleKey, CUP_EXCLUSION),
    [batch.length, shuffleKey]
  )

  // For lightbox nav — only photos matching current filter
  const navPhotos = useMemo(
    () => activeTag ? batch.filter(p => p.tags.includes(activeTag)) : batch,
    [batch, activeTag]
  )

  // Keep readyRef in sync so onCardLoaded can read it without being a dep
  useEffect(() => { readyRef.current = ready }, [ready])

  // When preloader fades and ready flips true, fire all deferred card animations
  useEffect(() => {
    if (!ready) return
    Object.entries(pendingAnimRef.current).forEach(([iStr, { el, delay }]) => {
      delete pendingAnimRef.current[parseInt(iStr)]
      gsap.to(el, { y: 0, opacity: 1, duration: 0.75, ease: 'back.out(1.6)', delay })
    })
  }, [ready])

  // ── Three.js wood table ──────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return
    const scene = new TableScene(canvasRef.current, { onReady: onAssetLoaded })
    scene.start()
    return () => scene.stop()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Light-reactive shadow RAF ────────────────────────────────────────
  useEffect(() => {
    const onMove = (e) => { lightTarget.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', onMove)

    const tick = () => {
      if (document.hidden) { shadowRafRef.current = null; return }
      shadowRafRef.current = requestAnimationFrame(tick)
      const lm = lightMouse.current
      const lt = lightTarget.current
      lm.x += (lt.x - lm.x) * 0.045
      lm.y += (lt.y - lm.y) * 0.045

      cardRefs.current.forEach(wrapper => {
        if (!wrapper) return
        const pEl = wrapper.querySelector('.polaroid')
        if (!pEl) return
        const rect = wrapper.getBoundingClientRect()
        if (rect.bottom < -300 || rect.top > window.innerHeight + 300) return

        const cx   = rect.left + rect.width  / 2
        const cy   = rect.top  + rect.height / 2
        const dx   = lm.x - cx
        const dy   = lm.y - cy
        const dist = Math.hypot(dx, dy)

        const max  = 24
        const f    = 0.030
        const csx  = Math.max(-max, Math.min(max, -dx * f))
        const csy  = Math.max(-max, Math.min(max, -dy * f))
        const blur = 10 + Math.min(dist * 0.04, 24)
        const opa  = (0.25 + Math.min(dist * 0.0008, 0.32)).toFixed(2)

        const isDragging = wrapper.dataset.dragging === '1'
        const hovered    = pEl.dataset.hovered === '1'
        const hnx        = parseFloat(pEl.dataset.nx || 0)
        const hny        = parseFloat(pEl.dataset.ny || 0)
        const shadowEl   = wrapper.querySelector('.polaroid-shadow')

        // Drive the shadow sprite instead of box-shadow
        pEl.style.boxShadow = 'none'
        if (shadowEl) {
          if (isDragging) {
            shadowEl.style.transform = 'translateX(3px) translateY(18px) scale(1.06)'
            shadowEl.style.opacity   = '0.22'
          } else if (hovered) {
            const tsx = -hnx * 4
            const tsy = -hny * 4 + 10
            shadowEl.style.transform = `translateX(${tsx.toFixed(1)}px) translateY(${tsy.toFixed(1)}px) scale(1.04)`
            shadowEl.style.opacity   = '0.36'
          } else {
            const tsx = (csx * 0.18).toFixed(1)
            const tsy = (Math.abs(csy) * 0.14 + 7).toFixed(1)
            const sOpa = (0.26 + Math.min(dist * 0.0002, 0.12)).toFixed(2)
            shadowEl.style.transform = `translateX(${tsx}px) translateY(${tsy}px) scale(1.03)`
            shadowEl.style.opacity   = sOpa
          }
        }
      })
    }
    const onVisibility = () => { if (!document.hidden && !shadowRafRef.current) tick() }
    document.addEventListener('visibilitychange', onVisibility)
    tick()

    return () => {
      cancelAnimationFrame(shadowRafRef.current)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // ── Fall-in on batch change — triggered per-card on image load ──────
  useEffect(() => {
    pendingAnimRef.current = {}
    loadedSetRef.current   = new Set()
    const sleeperIdx = batch.length - 1
    cardRefs.current.forEach((el, i) => {
      if (!el) return
      const isSleeper = i === sleeperIdx
      const rotation  = isSleeper ? -8 : (layout[i]?.rotation ?? 0)
      const zIndex    = isSleeper ? 6  : (layout[i]?.zIndex   ?? 1)
      gsap.set(el, {
        xPercent: -50, yPercent: -50, rotation, zIndex,
        x: 0, opacity: 0, y: -180,
        rotateX: 0, rotateY: 0,
        transformPerspective: 800,
      })
      pendingAnimRef.current[i] = { el, delay: 0.1 + i * 0.07 }
    })
  }, [batch, layout])

  // Called by PolaroidCard when its photo finishes loading (or errors/is cached).
  // Uses readyRef (not `ready` prop) as dep to avoid re-creating this function —
  // which would force all 9 memoized PolaroidCards to re-render on reveal.
  const onCardLoaded = useCallback((i) => {
    // Deduplicate: PolaroidCard can fire onImageLoad via both the useEffect (cached
    // path) and onLoad (network path). Only count each card index once.
    if (!loadedSetRef.current.has(i)) {
      loadedSetRef.current.add(i)
      onAssetLoaded?.()
    }

    const pending = pendingAnimRef.current[i]
    if (!pending) return
    const { el, delay } = pending

    // Apply developing class now (plays behind preloader; photo is ready on reveal)
    const img = el.querySelector('.polaroid-photo')
    if (img) {
      img.classList.remove('developing')
      void img.offsetWidth
      img.classList.add('developing')
    }

    if (readyRef.current) {
      // Preloader already gone — animate immediately
      delete pendingAnimRef.current[i]
      gsap.to(el, { y: 0, opacity: 1, duration: 0.75, ease: 'back.out(1.6)', delay })
    }
    // else: leave in pendingAnimRef; ready useEffect fires all deferred animations
  }, [onAssetLoaded])

  // ── Filter pile / restore ────────────────────────────────────────────
  //
  // State machine:
  //   activeTag set   → all cards drift to centre pile; matching: opacity 1, non-matching: opacity 0
  //   activeTag null  → all cards return to scatter (x:0, y:0)
  //
  // Deterministic pile offsets ensure every tag produces the same central arrangement.
  // PILE and table dims are hoisted above the loop (avoid 9× DOM reads + array re-creation).
  useEffect(() => {
    const sleeperIdx = batch.length - 1
    const table = cardRefs.current[0]?.closest('.scatter-table')
    const tW = table?.offsetWidth  || window.innerWidth
    const tH = table?.offsetHeight || window.innerHeight

    // Deterministic pile offsets by index — same arrangement for every tag
    const PILE = [
      { dx:   0, dy:   0, r:  3 },
      { dx: -18, dy:  12, r: -8 },
      { dx:  22, dy:  -8, r:  5 },
      { dx: -10, dy: -18, r: 12 },
      { dx:  14, dy:  20, r: -6 },
      { dx: -24, dy:   6, r: 10 },
      { dx:  10, dy: -24, r: -4 },
      { dx:  28, dy:  14, r:  7 },
      { dx: -16, dy:  26, r: -9 },
    ]

    batch.forEach((photo, i) => {
      const el = cardRefs.current[i]
      if (!el || !layout[i]) return
      const { rotation, zIndex } = layout[i]
      const matches = !activeTag || photo.tags.includes(activeTag)

      // Sleeper renders at sleeperPos, not layout[i] — use the correct CSS base
      const cssX = i === sleeperIdx ? sleeperPos.x : layout[i].x
      const cssY = i === sleeperIdx ? sleeperPos.y : layout[i].y
      const baseX = (cssX / 100) * tW
      const baseY = (cssY / 100) * tH

      if (matches) {
        let tx = 0, ty = 0, rot = rotation
        if (activeTag) {
          const p = PILE[i % PILE.length]
          tx = (tW * 0.5 - baseX) + p.dx
          ty = (tH * 0.5 - baseY) + p.dy
          rot = p.r
        }
        gsap.to(el, {
          x: tx, y: ty, rotation: rot, opacity: 1, zIndex,
          duration: 0.55, ease: 'back.out(1.4)',
          delay: 0.08 + i * 0.03,
          onStart: () => { el.style.pointerEvents = '' },
        })
      } else {
        // Non-matching: drift to centre and fade out
        const p = PILE[i % PILE.length]
        gsap.to(el, {
          x: (tW * 0.5 - baseX) + p.dx * 1.5,
          y: (tH * 0.5 - baseY) + p.dy * 1.5,
          rotation: p.r * 2,
          opacity: 0,
          duration: 0.45,
          ease: 'power2.in',
          delay: 0.03 * i,
          onStart: () => { el.style.pointerEvents = 'none' },
        })
      }
    })
  }, [activeTag])   // intentional — only when tag changes

  // ── Keyboard for lightbox ────────────────────────────────────────────
  useEffect(() => {
    if (!lightboxPhoto) return
    const idx = navPhotos.findIndex(p => p.id === lightboxPhoto.id)
    const onKey = (e) => {
      if (e.key === 'ArrowRight') setLightboxPhoto(navPhotos[(idx + 1) % navPhotos.length])
      if (e.key === 'ArrowLeft')  setLightboxPhoto(navPhotos[(idx - 1 + navPhotos.length) % navPhotos.length])
      if (e.key === 'Escape')     setLightboxPhoto(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxPhoto, navPhotos])

  // ── Drag with 2.5D physics ───────────────────────────────────────────
  const startDrag = useCallback((e, idx) => {
    if (e.button !== undefined && e.button !== 0) return
    const el = cardRefs.current[idx]
    if (!el) return

    gsap.killTweensOf(el)
    const newZ = Math.min(++topZRef.current, 999)
    gsap.set(el, { zIndex: newZ })

    // Clear inner hover state so it doesn't compound with drag tilt
    const pEl = el.querySelector('.polaroid')
    if (pEl) {
      pEl.style.transform = ''
      delete pEl.dataset.hovered
      delete pEl.dataset.nx
      delete pEl.dataset.ny
    }

    const x0   = gsap.getProperty(el, 'x')
    const y0   = gsap.getProperty(el, 'y')
    const rot0 = gsap.getProperty(el, 'rotation')
    const px0  = e.clientX
    const py0  = e.clientY

    // Grab offset from card center — used to compute angular momentum on throw
    const rect       = el.getBoundingClientRect()
    const grabOffX   = e.clientX - (rect.left + rect.width  / 2)
    const grabOffY   = e.clientY - (rect.top  + rect.height / 2)

    let hasDragged = false
    const hist = [{ x: px0, y: py0, t: performance.now() }]

    // Mark for shadow RAF
    el.dataset.dragging = '1'

    // Pick up — subtle z-lift for shadow depth cue
    gsap.to(el, { z: 28, duration: 0.14, ease: 'power2.out' })

    // Weighted velocity from a 100ms history window
    const getVelocity = (history) => {
      if (history.length < 2) return { vx: 0, vy: 0 }
      let tw = 0, wvx = 0, wvy = 0
      for (let i = 1; i < history.length; i++) {
        const dt = Math.max(history[i].t - history[i - 1].t, 1)
        const w  = i   // linear weight: newer = heavier
        wvx += ((history[i].x - history[i - 1].x) / dt) * w
        wvy += ((history[i].y - history[i - 1].y) / dt) * w
        tw  += w
      }
      return { vx: wvx / tw, vy: wvy / tw }  // px / ms
    }

    const onMove = (ev) => {
      const dx = ev.clientX - px0
      const dy = ev.clientY - py0
      if (!hasDragged && Math.hypot(dx, dy) < 5) return
      hasDragged = true

      const now = performance.now()
      hist.push({ x: ev.clientX, y: ev.clientY, t: now })
      // Slide window: keep last 100 ms, max 8 samples
      while (hist.length > 1 && now - hist[0].t > 100) hist.shift()
      if (hist.length > 8) hist.shift()

      const { vx, vy } = getVelocity(hist)

      // Subtle 3D tilt — gentle lean without deformation
      const tiltX = Math.max(-7, Math.min(7, -vy * 8))
      const tiltY = Math.max(-7, Math.min(7,  vx * 8))

      gsap.to(el, {
        x:       x0 + dx,
        y:       y0 + dy,
        rotateX: tiltX,
        rotateY: tiltY,
        duration: 0.05,
        ease:    'none',
        overwrite: true,
      })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.style.cursor = ''
      delete el.dataset.dragging

      if (!hasDragged) {
        // No drag — just reset tilt and z
        gsap.to(el, { rotateX: 0, rotateY: 0, z: 0, duration: 0.3, ease: 'power2.out' })
        return
      }

      const { vx: rvx, vy: rvy } = getVelocity(hist)
      const speed = Math.hypot(rvx, rvy)  // px / ms

      const cx = gsap.getProperty(el, 'x')
      const cy = gsap.getProperty(el, 'y')
      const cr = gsap.getProperty(el, 'rotation')

      if (speed > 0.18) {
        // Throw — modest distance, feels like sliding on a table, not launching
        const throwDist = Math.min(speed * 55, 180)
        const throwDur  = 0.5 + Math.min(speed / 6, 0.35)

        // Light spin from horizontal velocity + small lever-arm contribution
        const spinDeg = (grabOffX * rvy - grabOffY * rvx) * 0.025
                      + rvx * 3.5

        gsap.to(el, {
          x:        cx + rvx * throwDist,
          y:        cy + rvy * throwDist,
          rotation: cr + spinDeg,
          duration: throwDur,
          ease:     'power2.out',
        })
        // 3D tilt settles with a tiny bounce — card lands on table
        gsap.to(el, {
          rotateX: 0,
          rotateY: 0,
          z:       0,
          duration: throwDur * 0.65,
          ease:    'back.out(1.3)',
        })
      } else {
        // Gentle place — tiny bounce as it touches down
        gsap.to(el, {
          rotateX:  0,
          rotateY:  0,
          z:        0,
          rotation: cr + (Math.random() - 0.5) * 5,
          duration: 0.55,
          ease:     'back.out(1.3)',
        })
      }
    }

    document.body.style.cursor = 'grabbing'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
    window.addEventListener('pointercancel', onUp)
  }, [])

  // ── Shuffle handler ──────────────────────────────────────────────────
  const handleShuffle = () => {
    if (isShuffling) return
    setIsShuffling(true)
    setActiveTag(null)

    cardRefs.current.forEach(el => {
      if (!el) return
      const angle = Math.random() * Math.PI * 2
      const dist  = 700 + Math.random() * 600
      gsap.to(el, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 80,
        rotation: (Math.random() - 0.5) * 440,
        opacity: 0,
        duration: 0.38 + Math.random() * 0.2,
        ease: 'power3.in',
        delay: Math.random() * 0.12,
      })
    })

    setTimeout(() => {
      setShuffleKey(k => k + 1)
      setIsShuffling(false)
    }, 650)
  }

  return (
    <div className={`gallery-page${drawerOpen ? ' gallery-page--blurred' : ''}`}>
      <canvas ref={canvasRef} id="table-canvas" />

      <div className="gallery-controls">
        <FilterBar tags={tags} activeTag={activeTag} onSelect={setActiveTag} />
        <button className="shuffle-btn" onClick={handleShuffle} disabled={isShuffling}>
          <i className="lni lni-shuffle" />
          {isShuffling ? '…' : 'Get more images'}
        </button>
        <button className="gallery-view-btn" onClick={() => setDrawerOpen(true)} aria-label="Browse all photos">
          <i className="lni lni-gallery" />
        </button>
      </div>

      <div className="scatter-table">
        {batch.map((photo, i) => {
          const isSleeper = i === batch.length - 1
          const left = isSleeper ? `${sleeperPos.x}%` : `${layout[i]?.x ?? 50}%`
          const top  = isSleeper ? `${sleeperPos.y}%` : `${layout[i]?.y ?? 50}%`
          return (
            <div
              key={`${photo.id}-${i}-${shuffleKey}`}
              ref={el => { cardRefs.current[i] = el }}
              className={`scatter-wrapper${isSleeper ? ' scatter-wrapper--sleeper' : ''}`}
              style={{ left, top }}
              onPointerDown={e => startDrag(e, i)}
              onDoubleClick={() => setLightboxPhoto(photo)}
            >
              <PolaroidCard
                photo={photo}
                onClick={() => setLightboxPhoto(photo)}
                onImageLoad={() => onCardLoaded(i)}
              />
            </div>
          )
        })}
      </div>

      <div className="gallery-hint" key={shuffleKey}>
        double-click a photo to open it
      </div>

      <div className={`bio-overlay${bioVisible ? ' bio-overlay--active' : ''}`} />
      <BioText
        onShow={() => setBioVisible(true)}
        onDismissStart={() => setBioVisible(false)}
      />

      <CoffeeCup onAssetLoaded={onAssetLoaded} />

      <DustParticles />

      <Drawer
        photos={photos}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onPhotoClick={setLightboxPhoto}
        tags={tags}
        activeTag={activeTag}
        onTagSelect={setActiveTag}
      />

      {lightboxPhoto && (
        <Lightbox
          photo={lightboxPhoto}
          photos={navPhotos}
          onClose={() => setLightboxPhoto(null)}
          onNav={setLightboxPhoto}
        />
      )}
    </div>
  )
}

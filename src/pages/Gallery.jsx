import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import PolaroidCard from '../components/PolaroidCard.jsx'
import FilterBar    from '../components/FilterBar.jsx'
import Lightbox     from '../components/Lightbox.jsx'
import CoffeeCup    from '../components/CoffeeCup.jsx'
import { getAllTags } from '../lib/photos.js'
import { TableScene } from '../gl/TableScene.js'

gsap.registerPlugin(ScrollTrigger)

export default function Gallery({ photos }) {
  const canvasRef  = useRef(null)
  const cardRefs   = useRef([])
  const hasInited  = useRef(false)

  const [activeTag,     setActiveTag]     = useState(null)
  const [lightboxPhoto, setLightboxPhoto] = useState(null)

  const tags = useMemo(() => getAllTags(photos), [photos])

  // Photos visible in lightbox depend on active filter
  const visiblePhotos = useMemo(
    () => activeTag ? photos.filter(p => p.tags.includes(activeTag)) : photos,
    [photos, activeTag]
  )

  // ── Three.js table scene ──────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return
    const scene = new TableScene(canvasRef.current)
    scene.start()
    return () => scene.stop()
  }, [])

  // ── Polaroid fall-in (scroll-triggered) ──────────────────────────
  useEffect(() => {
    const triggers = []

    cardRefs.current.forEach((el, i) => {
      if (!el) return
      const { rotation, tiltY } = photos[i]

      // Set stable rotation & tilt, start hidden above viewport
      gsap.set(el, { rotation, y: tiltY, x: 0, opacity: 0, scale: 1 })

      const t = ScrollTrigger.create({
        trigger: el,
        start:   'top 96%',
        onEnter: () => {
          gsap.fromTo(
            el,
            { y: tiltY - 180, opacity: 0 },
            {
              y:        tiltY,
              opacity:  1,
              duration: 0.7,
              ease:     'back.out(1.5)',
              delay:    (i % 3) * 0.09,
            }
          )
        },
        once: true,
      })
      triggers.push(t)
    })

    hasInited.current = true
    return () => triggers.forEach(t => t.kill())
  }, [photos])

  // ── Filter blow-away ──────────────────────────────────────────────
  useEffect(() => {
    if (!hasInited.current) return

    photos.forEach((photo, i) => {
      const el = photos[i] && cardRefs.current[i]
      if (!el) return

      const { rotation, tiltY } = photo
      const matches = !activeTag || photo.tags.includes(activeTag)

      if (matches) {
        gsap.to(el, {
          x:        0,
          y:        tiltY,
          rotation,
          opacity:  1,
          scale:    1,
          duration: 0.55,
          ease:     'back.out(1.4)',
          delay:    0.1 + i * 0.03,
          onStart:  () => { el.style.pointerEvents = '' },
        })
      } else {
        const angle = Math.random() * Math.PI * 2
        const dist  = 650 + Math.random() * 550
        gsap.to(el, {
          x:        Math.cos(angle) * dist,
          y:        Math.sin(angle) * dist - 120,
          rotation: rotation + (Math.random() - 0.5) * 360,
          opacity:  0,
          scale:    0.85,
          duration: 0.35 + Math.random() * 0.25,
          ease:     'power3.in',
          delay:    Math.random() * 0.18,
          onStart:  () => { el.style.pointerEvents = 'none' },
        })
      }
    })
  }, [activeTag]) // intentional: runs only when tag changes

  // ── Keyboard for lightbox ─────────────────────────────────────────
  const handleNav = useCallback(p => setLightboxPhoto(p), [])

  useEffect(() => {
    if (!lightboxPhoto) return
    const idx = visiblePhotos.findIndex(p => p.id === lightboxPhoto.id)

    const onKey = (e) => {
      if (e.key === 'ArrowRight') handleNav(visiblePhotos[(idx + 1) % visiblePhotos.length])
      if (e.key === 'ArrowLeft')  handleNav(visiblePhotos[(idx - 1 + visiblePhotos.length) % visiblePhotos.length])
      if (e.key === 'Escape')     setLightboxPhoto(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxPhoto, visiblePhotos, handleNav])

  return (
    <div className="gallery-page">
      <canvas ref={canvasRef} id="table-canvas" />

      <FilterBar tags={tags} activeTag={activeTag} onSelect={setActiveTag} />

      <div className="gallery-grid">
        {photos.map((photo, i) => (
          <div
            key={photo.id}
            ref={el => { cardRefs.current[i] = el }}
            className="polaroid-wrapper"
          >
            <PolaroidCard
              photo={photo}
              onClick={() => setLightboxPhoto(photo)}
            />
          </div>
        ))}
      </div>

      <CoffeeCup />

      {lightboxPhoto && (
        <Lightbox
          photo={lightboxPhoto}
          photos={visiblePhotos}
          onClose={() => setLightboxPhoto(null)}
          onNav={handleNav}
        />
      )}
    </div>
  )
}

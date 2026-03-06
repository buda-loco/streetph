import { useEffect, useRef, useState } from 'react'
import Logo from './Logo'

function oneLinePlayerUrl(videoUrl, poster, loop) {
  const params = new URLSearchParams({
    videoUrl,
    autoplay:         'false',
    autopause:        'true',
    muted:            'false',
    loop:             loop ? 'true' : 'false',
    time:             'true',
    progressBar:      'true',
    overlay:          'true',
    muteButton:       'true',
    fullscreenButton: 'true',
    style:            'dark',
    quality:          'auto',
    playButton:       'true',
    color:            'c8a96e',
  })
  if (poster) params.set('poster', poster)
  return `https://onelineplayer.com/player.html?${params.toString()}`
}

export default function Lightbox({ photo, photos, onClose, onNav }) {
  const overlayRef   = useRef(null)
  const imgRef       = useRef(null)
  const mediaRef     = useRef(null)
  const panRef       = useRef({ x: 0, y: 0 })
  const targetPanRef = useRef({ x: 0, y: 0 })
  const zoomRafRef   = useRef(null)

  const [zoomed,     setZoomed]     = useState(false)
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 })

  const currentIndex = photos.findIndex(p => p.id === photo.id)
  const goNext = () => { setZoomed(false); onNav(photos[(currentIndex + 1) % photos.length]) }
  const goPrev = () => { setZoomed(false); onNav(photos[(currentIndex - 1 + photos.length) % photos.length]) }

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Reset zoom when photo changes
  useEffect(() => { setZoomed(false) }, [photo.id])

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'Escape')     zoomed ? setZoomed(false) : onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentIndex, photos, zoomed])

  // Magnifier RAF — pans image when zoomed
  useEffect(() => {
    if (!zoomed || !imgRef.current || !mediaRef.current) return

    const media = mediaRef.current
    panRef.current       = { x: 0, y: 0 }
    targetPanRef.current = { x: 0, y: 0 }

    const onMove = (e) => {
      const rect = media.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width  - 0.5  // -0.5 to 0.5
      const ny = (e.clientY - rect.top)  / rect.height - 0.5
      targetPanRef.current = { x: -nx * 35, y: -ny * 35 }
    }
    media.addEventListener('mousemove', onMove)

    const tick = () => {
      zoomRafRef.current = requestAnimationFrame(tick)
      const p = panRef.current
      const t = targetPanRef.current
      p.x += (t.x - p.x) * 0.06
      p.y += (t.y - p.y) * 0.06
      if (imgRef.current) {
        imgRef.current.style.transformOrigin = `${zoomOrigin.x}% ${zoomOrigin.y}%`
        imgRef.current.style.transform       = `scale(2.6) translate(${p.x}%, ${p.y}%)`
      }
    }
    tick()

    return () => {
      cancelAnimationFrame(zoomRafRef.current)
      media.removeEventListener('mousemove', onMove)
      // Ease back to natural size instead of snapping
      if (imgRef.current) {
        imgRef.current.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        imgRef.current.style.transform  = 'scale(1)'
        imgRef.current.addEventListener('transitionend', () => {
          if (imgRef.current) {
            imgRef.current.style.transition = ''
            imgRef.current.style.transform  = ''
          }
        }, { once: true })
      }
    }
  }, [zoomed, zoomOrigin])

  const handleImageClick = (e) => {
    if (zoomed) { setZoomed(false); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setZoomOrigin({
      x: ((e.clientX - rect.left) / rect.width)  * 100,
      y: ((e.clientY - rect.top)  / rect.height) * 100,
    })
    setZoomed(true)
  }

  return (
    <div
      className="lb-overlay"
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && onClose()}
    >
      <div className="lb-shell">
        <button className="lb-close" onClick={onClose} aria-label="Close">✕</button>

        <button className="lb-nav lb-prev" onClick={goPrev} aria-label="Previous">
          <span>←</span>
        </button>

        {/* Media */}
        <div className={`lb-media ${zoomed ? 'lb-media--zoomed' : ''}`} ref={mediaRef}>
          {photo.video ? (
            <iframe
              key={photo.id}
              src={oneLinePlayerUrl(photo.video, photo.videoPoster, photo.videoLoop)}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="lb-video"
              title={photo.title || 'Video'}
            />
          ) : (
            <img
              key={photo.id}
              ref={imgRef}
              src={photo.dropbox}
              alt={photo.title || 'Street photo'}
              className={`lb-image ${zoomed ? 'lb-image--zoomed' : ''}`}
              onClick={handleImageClick}
              draggable="false"
            />
          )}
          {/* Logo stamp — fixed in corner, unaffected by image zoom/pan transform */}
          <Logo className="lb-stamp" />

          {zoomed && (
            <div className="lb-zoom-hint">click to exit zoom</div>
          )}
          {!zoomed && !photo.video && (
            <div className="lb-zoom-hint lb-zoom-hint--idle">double-click to zoom</div>
          )}
        </div>

        {/* Details */}
        <div className="lb-details">
          <div className="lb-meta">
            {photo.title && <h2 className="lb-title">{photo.title}</h2>}
            <div className="lb-sub">
              {photo.location && <span>{photo.location}</span>}
              {photo.date     && <span>{photo.date}</span>}
            </div>
            {photo.tags.length > 0 && (
              <div className="lb-tags">
                {photo.tags.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
            )}
          </div>

          {photo.hasText && (
            <div className="lb-text" dangerouslySetInnerHTML={{ __html: photo.body }} />
          )}

          <div className="lb-counter">{currentIndex + 1} / {photos.length}</div>
        </div>

        <button className="lb-nav lb-next" onClick={goNext} aria-label="Next">
          <span>→</span>
        </button>
      </div>
    </div>
  )
}

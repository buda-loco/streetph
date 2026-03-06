import { useEffect, useRef, useState } from 'react'

function toCols(photos, n) {
  const cols = Array.from({ length: n }, () => [])
  photos.forEach((p, i) => cols[i % n].push(p))
  return cols
}

export default function Drawer({ photos, open, onClose, onPhotoClick }) {
  const scrollRef  = useRef(null)
  const colRefs    = useRef([])
  // Increments each time drawer opens — used as key to restart stagger animations
  const [epoch, setEpoch] = useState(0)

  useEffect(() => {
    if (open) setEpoch(e => e + 1)
  }, [open])

  // Parallax — direct DOM, no re-renders
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const rates = [-0.07, 0.05, -0.04]
    const onScroll = () => {
      const s = el.scrollTop
      colRefs.current.forEach((col, i) => {
        if (col) col.style.transform = `translateY(${s * rates[i]}px)`
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = 0
  }, [open])

  const cols = toCols(photos, 3)

  return (
    <>
      <div
        className={`drawer-backdrop${open ? ' drawer-backdrop--open' : ''}`}
        onClick={onClose}
      />

      <div className={`drawer${open ? ' drawer--open' : ''}`} role="dialog" aria-modal="true">
        <div className="drawer-header">
          <span className="drawer-title">All Photos</span>
          <button className="drawer-close" onClick={onClose} aria-label="Close gallery">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="drawer-scroll" ref={scrollRef}>

          {/* Desktop: 3-col parallax masonry — epoch key restarts stagger animations */}
          <div key={`d-${epoch}`} className="masonry-grid masonry-grid--desktop">
            {cols.map((col, ci) => (
              <div
                key={ci}
                className="masonry-col"
                ref={el => { colRefs.current[ci] = el }}
                style={{ paddingTop: ci === 1 ? 56 : ci === 2 ? 28 : 0 }}
              >
                {col.map((photo, ji) => (
                  <button
                    key={photo.id}
                    className="masonry-item"
                    style={{ '--delay': `${0.28 + ci * 0.04 + ji * 0.07}s` }}
                    onClick={() => { onPhotoClick(photo); onClose() }}
                  >
                    <img src={photo.dropbox} alt={photo.title || ''} loading="lazy" draggable="false" />
                    {photo.title && <span className="masonry-caption">{photo.title}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Mobile: single column */}
          <div key={`m-${epoch}`} className="masonry-grid masonry-grid--mobile">
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                className="masonry-item"
                style={{ '--delay': `${0.28 + i * 0.055}s` }}
                onClick={() => { onPhotoClick(photo); onClose() }}
              >
                <img src={photo.dropbox} alt={photo.title || ''} loading="lazy" draggable="false" />
                {photo.title && <span className="masonry-caption">{photo.title}</span>}
              </button>
            ))}
          </div>

        </div>
      </div>
    </>
  )
}

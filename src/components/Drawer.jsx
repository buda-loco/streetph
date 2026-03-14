import { useEffect, useRef, useState } from 'react'
import Logo from './Logo'

function toCols(photos, n) {
  const cols = Array.from({ length: n }, () => [])
  photos.forEach((p, i) => cols[i % n].push(p))
  return cols
}

export default function Drawer({ photos, open, onClose, onPhotoClick, tags, activeTag, onTagSelect }) {
  const scrollRef = useRef(null)
  const colRefs   = useRef([])
  const [epoch, setEpoch] = useState(0)
  const [loadedIds, setLoadedIds] = useState(new Set())

  useEffect(() => {
    if (open) setEpoch(e => e + 1)
  }, [open])

  // Desktop parallax scroll
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

  // Reset loaded state when filter changes so skeletons re-appear
  useEffect(() => { setLoadedIds(new Set()) }, [activeTag])

  // Filtered photos for mobile (all photos filtered by tag)
  const mobilePhotos = activeTag
    ? photos.filter(p => p.tags?.includes(activeTag))
    : photos

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

        {/* Mobile filter strip — horizontal scroll with spacer gutters */}
        {tags?.length > 0 && (
          <div className="drawer-filter-strip">
            <button
              className={`filter-btn${!activeTag ? ' active' : ''}`}
              onClick={() => onTagSelect?.(null)}
            >
              All
            </button>
            {tags.map(tag => (
              <button
                key={tag}
                className={`filter-btn${activeTag === tag ? ' active' : ''}`}
                onClick={() => onTagSelect?.(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="drawer-scroll" ref={scrollRef}>

          {/* Desktop: 3-col parallax masonry */}
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
                    <img src={photo.image} alt={photo.title || ''} loading="lazy" draggable="false" />
                    {photo.title && <span className="masonry-caption">{photo.title}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Mobile: single column with staggered CSS animation + skeleton loading */}
          <div key={`m-${activeTag}`} className="masonry-grid masonry-grid--mobile">
            {mobilePhotos.map((photo, i) => {
              const loaded = loadedIds.has(photo.id)
              return (
                <button
                  key={photo.id}
                  className={`masonry-item${loaded ? '' : ' masonry-item--pending'}`}
                  style={{ '--delay': `${0.05 + i * 0.06}s` }}
                  onClick={() => onPhotoClick(photo)}
                >
                  <div className="masonry-img-wrap">
                    {!loaded && (
                      <div className="masonry-skeleton">
                        <Logo className="masonry-skeleton-logo" />
                      </div>
                    )}
                    <img
                      src={photo.image}
                      alt={photo.title || ''}
                      loading="eager"
                      draggable="false"
                      className={loaded ? 'masonry-photo--loaded' : 'masonry-photo'}
                      onLoad={() => setLoadedIds(prev => new Set([...prev, photo.id]))}
                    />
                  </div>
                  {photo.title && <span className="masonry-caption">{photo.title}</span>}
                </button>
              )
            })}
          </div>

          {/* Social links — mobile only, inline at bottom of gallery */}
          <div className="mobile-social-bar">
            <a href="https://instagram.com/benarnedo" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <i className="lni lni-instagram-original" />
            </a>
            <a href="https://www.linkedin.com/in/benjaminarnedo/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <i className="lni lni-linkedin-original" />
            </a>
          </div>

        </div>
      </div>
    </>
  )
}

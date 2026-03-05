import { useEffect, useRef } from 'react'

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
  const overlayRef = useRef(null)
  const currentIndex = photos.findIndex(p => p.id === photo.id)

  const goNext = () => onNav(photos[(currentIndex + 1) % photos.length])
  const goPrev = () => onNav(photos[(currentIndex - 1 + photos.length) % photos.length])

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'Escape')     onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentIndex, photos])

  return (
    <div
      className="lb-overlay"
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && onClose()}
    >
      <div className="lb-shell">

        {/* Close */}
        <button className="lb-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Prev */}
        <button className="lb-nav lb-prev" onClick={goPrev} aria-label="Previous">
          <span>←</span>
        </button>

        {/* Media */}
        <div className="lb-media">
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
              src={photo.dropbox}
              alt={photo.title || 'Street photo'}
              className="lb-image"
            />
          )}
        </div>

        {/* Details panel */}
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
            <div
              className="lb-text"
              dangerouslySetInnerHTML={{ __html: photo.body }}
            />
          )}

          <div className="lb-counter">{currentIndex + 1} / {photos.length}</div>
        </div>

        {/* Next */}
        <button className="lb-nav lb-next" onClick={goNext} aria-label="Next">
          <span>→</span>
        </button>

      </div>
    </div>
  )
}

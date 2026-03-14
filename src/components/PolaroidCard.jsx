import { memo, useEffect, useRef } from 'react'
import Logo from './Logo'

const STICKY_COLORS = ['#FFFF88', '#A6CCF5', '#EA94BB', '#D5F692']

// Positions: mostly hanging off polaroid edges/corners so photo is minimally obscured.
// Each entry sets top/right/left/bottom + rotation as inline style.
const STICKY_CONFIGS = [
  { top: '6px', right: '-14px',                 transform: 'rotate(4deg)'  },
  { top: '6px', left:  '-14px', right: 'auto',  transform: 'rotate(-3deg)' },
  { top: '6px', right:  '32px',                 transform: 'rotate(2deg)'  },
  { top: '6px', left:   '32px', right: 'auto',  transform: 'rotate(-5deg)' },
  { top: '6px', right: '-52px',                 transform: 'rotate(6deg)'  },
  { top: '6px', left:  '-52px', right: 'auto',  transform: 'rotate(-4deg)' },
]

// Stable pseudo-random pick per photo — same photo always gets same config
function pickSticky(id) {
  const h = String(id ?? '').split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 17)
  const color = STICKY_COLORS[((h)        % STICKY_COLORS.length  + STICKY_COLORS.length)  % STICKY_COLORS.length]
  const cfg   = STICKY_CONFIGS[((h * 7)   % STICKY_CONFIGS.length + STICKY_CONFIGS.length) % STICKY_CONFIGS.length]
  return { color, cfg }
}

const PolaroidCard = memo(function PolaroidCard({ photo, onClick, onImageLoad }) {
  const imgRef = useRef(null)

  // Fire onImageLoad for already-cached images (onLoad won't fire for those)
  useEffect(() => {
    if (imgRef.current?.complete) onImageLoad?.()
  }, [])
  const snippet = photo.hasText
    ? photo.bodyPlain.slice(0, 60).trim() + (photo.bodyPlain.length > 60 ? '…' : '')
    : null

  const { color: stickyColor, cfg: stickyCfg } = pickSticky(photo.id)

  const handleMouseMove = (e) => {
    const el   = e.currentTarget
    const rect = el.getBoundingClientRect()
    const nx   = (e.clientX - rect.left)  / rect.width  * 2 - 1  // -1 to 1
    const ny   = (e.clientY - rect.top)   / rect.height * 2 - 1  // -1 to 1
    el.style.transform      = `rotateX(${-ny * 14}deg) rotateY(${nx * 14}deg) translateZ(20px)`
    el.dataset.hovered      = '1'
    el.dataset.nx           = nx
    el.dataset.ny           = ny
  }

  const handleMouseLeave = (e) => {
    const el = e.currentTarget
    el.style.transform = ''
    delete el.dataset.hovered
    delete el.dataset.nx
    delete el.dataset.ny
  }

  return (
    <div className="polaroid-wrapper">
      {/* Shadow sprite — rendered behind card, animated by Gallery RAF */}
      <img
        src="/table/polaroid-shadow.webp"
        className="polaroid-shadow"
        draggable="false"
        alt=""
      />
      <div
        className="polaroid"
        onClick={e => { if (e.detail === 0 && onClick) onClick() }}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onClick()}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="polaroid-photo-wrap">
          <img
            ref={imgRef}
            src={photo.image}
            alt={photo.title || 'Street photo'}
            className="polaroid-photo"
            draggable="false"
            onLoad={onImageLoad}
            onError={onImageLoad}
          />
          <Logo className="polaroid-stamp" />
        </div>

        <div className="polaroid-caption">
          {photo.title || photo.location || '\u00a0'}
        </div>

        {/* Realistic aged polaroid paper overlay */}
        <img
          src="/table/polaroid-frame.webp"
          alt=""
          className="polaroid-frame"
          draggable="false"
        />

        {/* Sticky note — rendered after frame so it's above it in paint order (preserve-3d ignores z-index) */}
        {snippet && (
          <div className="sticky-note" style={{ background: stickyColor, ...stickyCfg }}>
            <span className="sticky-text">{snippet}</span>
          </div>
        )}
      </div>
    </div>
  )
})

export default PolaroidCard

import { forwardRef } from 'react'

const PolaroidCard = forwardRef(function PolaroidCard({ photo, onClick }, ref) {
  // Short poem snippet for the sticky note
  const snippet = photo.hasText
    ? photo.bodyPlain.slice(0, 55).trim() + (photo.bodyPlain.length > 55 ? '…' : '')
    : null

  return (
    <div ref={ref} className="polaroid-wrapper">
      <div className="polaroid" onClick={onClick} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onClick()}>

        {snippet && (
          <div className="sticky-note">
            <span className="sticky-text">{snippet}</span>
          </div>
        )}

        <div className="polaroid-photo-wrap">
          <img
            src={photo.dropbox}
            alt={photo.title || 'Street photo'}
            className="polaroid-photo"
            loading="lazy"
            draggable="false"
          />
        </div>

        <div className="polaroid-caption">
          {photo.title || photo.location || '\u00a0'}
        </div>
      </div>
    </div>
  )
})

export default PolaroidCard

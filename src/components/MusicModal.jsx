import { useEffect, useState } from 'react'

export default function MusicToast({ onYes, onNo }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 120)
    return () => clearTimeout(t)
  }, [])

  const handleYes = () => {
    onYes()          // synchronous — preserves user gesture for YouTube
    setVisible(false)
  }
  const handleNo = () => {
    setVisible(false)
    onNo()
  }

  return (
    <div className={`music-toast ${visible ? 'music-toast--visible' : ''}`}>
      <div className="music-toast-body">
        <i className="lni lni-music music-toast-icon" />
        <p className="music-toast-text">
          This site has a soundtrack — want to listen?
        </p>
      </div>
      <div className="music-toast-actions">
        <button className="music-toast-btn music-toast-btn--yes" onClick={handleYes}>
          Hell, yes.
        </button>
        <button className="music-toast-btn music-toast-btn--no" onClick={handleNo}>
          no thanks
        </button>
      </div>
    </div>
  )
}

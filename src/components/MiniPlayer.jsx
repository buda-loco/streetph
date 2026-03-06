import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'

import playlistData from '../content/playlist.json'
const PLAYLIST_ID = playlistData.id

// ─── YouTube IFrame API singleton ────────────────────────────────────────────
// Handles multiple React StrictMode calls safely
let _ytReady = false
const _ytQueue = []

function ensureYTAPI(cb) {
  if (_ytReady) { cb(); return }
  _ytQueue.push(cb)
  if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return
  const s = document.createElement('script')
  s.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(s)
  window.onYouTubeIframeAPIReady = () => {
    _ytReady = true
    _ytQueue.forEach(fn => fn())
    _ytQueue.length = 0
  }
}

const MiniPlayer = forwardRef(function MiniPlayer(_, ref) {
  const playerRef  = useRef(null)
  const mountRef   = useRef(null)
  const [playing,  setPlaying]  = useState(false)
  const [title,    setTitle]    = useState('')
  const [ready,    setReady]    = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Expose play() so the parent can call it synchronously inside a user-gesture handler
  useImperativeHandle(ref, () => ({
    play() {
      playerRef.current?.playVideo()
      setExpanded(true)
    },
  }))

  const readTitle = useCallback(() => {
    try {
      const resp = playerRef.current?.getPlayerResponse()
      const t = resp?.videoDetails?.title || ''
      setTitle(t)
    } catch { /* not yet available */ }
  }, [])

  useEffect(() => {
    let destroyed = false

    ensureYTAPI(() => {
      if (destroyed || !mountRef.current) return

      const player = new window.YT.Player(mountRef.current, {
        height: '1',
        width: '1',
        playerVars: {
          listType:    'playlist',
          list:        PLAYLIST_ID,
          autoplay:    0,
          controls:    0,
          playsinline: 1,
          rel:         0,
        },
        events: {
          onReady() {
            if (destroyed) return
            playerRef.current = player
            setReady(true)
          },
          onStateChange(e) {
            if (destroyed) return
            const isPlaying = e.data === window.YT.PlayerState.PLAYING
            setPlaying(isPlaying)
            if (isPlaying) readTitle()
          },
          onError() {
            // Skip unplayable videos automatically
            playerRef.current?.nextVideo()
          },
        },
      })
    })

    return () => {
      destroyed = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [readTitle])

  const toggle = () => playing
    ? playerRef.current?.pauseVideo()
    : playerRef.current?.playVideo()

  const prev = () => { playerRef.current?.previousVideo(); setTimeout(readTitle, 800) }
  const next = () => { playerRef.current?.nextVideo();     setTimeout(readTitle, 800) }

  return (
    <div className={[
      'mini-player',
      ready    ? 'mini-player--ready'    : '',
      expanded ? 'mini-player--expanded' : '',
    ].join(' ')}>
      {/* Hidden YouTube mount — rendered in-tree so ref is stable */}
      <div
        ref={mountRef}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}
      />

      {/* Vinyl icon — acts as expand/collapse toggle */}
      <button
        className="mini-player-icon"
        onClick={() => setExpanded(x => !x)}
        aria-label={expanded ? 'Collapse player' : 'Expand player'}
      >
        <i className={`lni lni-music${playing ? ' mini-player-spinning' : ''}`} />
      </button>

      {/* Expandable body */}
      <div className="mini-player-body">
        <p className="mini-player-title" title={title}>
          {title || (ready ? '—' : 'Loading…')}
        </p>
        <div className="mini-player-controls">
          <button onClick={prev} aria-label="Previous" disabled={!ready}>
            <i className="lni lni-backward" />
          </button>

          <button
            onClick={toggle}
            className="mini-player-play"
            aria-label={playing ? 'Pause' : 'Play'}
            disabled={!ready}
          >
            <i className={`lni lni-${playing ? 'pause' : 'play'}`} />
          </button>

          <button onClick={next} aria-label="Next" disabled={!ready}>
            <i className="lni lni-forward" />
          </button>
        </div>
      </div>
    </div>
  )
})

export default MiniPlayer

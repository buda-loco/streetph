import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import rawBio from '../content/bio.md?raw'

// ─── Markdown helpers ─────────────────────────────────────────────────────────
const INLINE_RE = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g

function splitSentences(text) {
  return text.trim().split(/(?<=[.!?])\s+/).filter(Boolean)
}

function parseInline(sentence) {
  INLINE_RE.lastIndex = 0
  const parts = []
  let last = 0, m
  while ((m = INLINE_RE.exec(sentence)) !== null) {
    if (m.index > last) parts.push({ type: 'text', text: sentence.slice(last, m.index) })
    parts.push({ type: 'link', text: m[1], href: m[2] })
    last = m.index + m[0].length
  }
  if (last < sentence.length) parts.push({ type: 'text', text: sentence.slice(last) })
  return parts
}

export default function BioText({ onShow, onDismissStart }) {
  const wrapRef  = useRef(null)
  const lineRefs = useRef([])
  const [dismissed, setDismissed] = useState(false)

  const sentences = splitSentences(rawBio)

  // Pop the note in from the bottom, then stagger the text
  useEffect(() => {
    if (dismissed || !wrapRef.current) return

    const wrap = wrapRef.current
    const lines = lineRefs.current.filter(Boolean)

    // Reset state
    gsap.set(wrap,  { y: '110%', opacity: 1 })
    gsap.set(lines, { opacity: 0, y: 10 })

    const tl = gsap.timeline({ delay: 1.6, onStart: () => onShow?.() })

    // Note pops up from below with a satisfying bounce
    tl.to(wrap, {
      y: 0,
      duration: 0.85,
      ease: 'back.out(1.5)',
    })
    // Text sentences stagger in after the note lands
    tl.to(lines, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power3.out',
      stagger: 0.07,
    }, '-=0.1')

    return () => tl.kill()
  }, [dismissed])

  const handleClose = () => {
    const wrap = wrapRef.current
    if (!wrap) return
    onDismissStart?.()
    gsap.to(wrap, {
      y: -60,
      opacity: 0,
      duration: 0.52,
      ease: 'power3.in',
      onComplete: () => setDismissed(true),
    })
  }

  if (dismissed) return null

  return (
    <div className="bio-note-outer">
      <div className="bio-note-wrap" ref={wrapRef}>
      <div className="bio-note">
        {/* Post-it paper texture */}
        <img
          src="/table/post-it.webp"
          className="bio-note-paper"
          alt=""
          draggable="false"
        />

        {/* Text layer — absolutely positioned over the paper, below the tape */}
        <div className="bio-note-content">
          {sentences.map((sentence, si) => (
            <span
              key={si}
              ref={el => { lineRefs.current[si] = el }}
              className="bio-sentence"
            >
              {parseInline(sentence).map((part, pi) =>
                part.type === 'link'
                  ? (
                    <a
                      key={pi}
                      href={part.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bio-link"
                    >
                      {part.text}
                    </a>
                  )
                  : <span key={pi}>{part.text}</span>
              )}
              {si < sentences.length - 1 ? ' ' : ''}
            </span>
          ))}
        </div>

        {/* Dismiss button — on top of the note, bottom-centre */}
        <button className="bio-note-close" onClick={handleClose} aria-label="Dismiss">
          <i className="lni lni-close" />
          <span>dismiss</span>
        </button>
      </div>
      </div>
    </div>
  )
}

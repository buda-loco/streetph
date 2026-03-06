import rawBio from '../content/bio.md?raw'
import contactData from '../content/contact.json'

const INLINE_RE = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g

function parseInline(text) {
  INLINE_RE.lastIndex = 0
  const parts = []
  let last = 0, m
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) })
    parts.push({ type: 'link', text: m[1], href: m[2] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })
  return parts
}

export default function About() {
  const { email, instagram, linkedin } = contactData
  return (
    <section className="inner-page">
      <div className="inner-page-content">
        <p className="page-label">About</p>

        <div className="about-bio">
          <p>
            {parseInline(rawBio.trim()).map((part, i) =>
              part.type === 'link'
                ? <a key={i} href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>
                : <span key={i}>{part.text}</span>
            )}
          </p>
        </div>

        <div className="about-links">
          <a href={instagram.url} target="_blank" rel="noopener noreferrer">{instagram.handle}</a>
          <a href={linkedin.url}  target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a href={`mailto:${email}`}>{email}</a>
        </div>
      </div>
    </section>
  )
}

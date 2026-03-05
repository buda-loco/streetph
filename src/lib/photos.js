import { marked } from 'marked'

// Load all markdown files from /photos/ as raw strings
const rawFiles = import.meta.glob('../../photos/*.md', { eager: true, query: '?raw', import: 'default' })

// Converts a Dropbox share link to a direct-load image URL
export function toDirectUrl(url) {
  if (!url) return url
  try {
    const u = new URL(url)
    if (u.hostname === 'www.dropbox.com' || u.hostname === 'dropbox.com') {
      u.hostname = 'dl.dropboxusercontent.com'
      u.searchParams.set('raw', '1')
      u.searchParams.delete('dl')
    }
    return u.toString()
  } catch {
    return url
  }
}

// Minimal YAML-like frontmatter parser (avoids gray-matter browser issues)
function parseMd(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/)
  if (!match) return { data: {}, content: raw.trim() }

  const data = {}
  match[1].split('\n').forEach(line => {
    if (line.startsWith('#') || !line.trim()) return
    const col = line.indexOf(':')
    if (col === -1) return
    const key = line.slice(0, col).trim()
    const val = line.slice(col + 1).trim()
    if (!key) return
    if (val === 'true') data[key] = true
    else if (val === 'false') data[key] = false
    else if (val.startsWith('[')) {
      try { data[key] = JSON.parse(val.replace(/'/g, '"')) } catch { data[key] = [] }
    } else {
      data[key] = val.replace(/^["']|["']$/g, '')
    }
  })

  return { data, content: match[2].trim() }
}

function seededRng(seed) {
  let s = (seed + 1) * 2654435769
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s ^= s >>> 16
    return (s >>> 0) / 0xffffffff
  }
}

export function loadPhotos() {
  return Object.entries(rawFiles)
    .filter(([path]) => !path.includes('_template'))
    .map(([filepath, raw]) => {
      const { data, content } = parseMd(raw)
      const id = filepath.split('/').pop().replace('.md', '')
      const rng = seededRng(hashStr(id))
      return {
        id,
        title: data.title || '',
        date: data.date || null,
        location: data.location || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        dropbox: data.dropbox ? toDirectUrl(data.dropbox) : null,
        video: data.video || null,
        videoPoster: data.videoPoster || null,
        videoLoop: data.videoLoop || false,
        featured: data.featured || false,
        body: content ? marked.parse(content) : '',
        hasText: content.trim().length > 0,
        bodyPlain: content.replace(/<[^>]*>/g, '').trim(),
        // stable layout values (rotation + tiltY)
        rotation: (rng() - 0.5) * 22,
        tiltY: (rng() - 0.5) * 30,
      }
    })
    .filter(p => p.dropbox || p.video)
    .sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(b.date) - new Date(a.date)
    })
}

export function getAllTags(photos) {
  const s = new Set()
  photos.forEach(p => p.tags.forEach(t => s.add(t)))
  return Array.from(s).sort()
}

function hashStr(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

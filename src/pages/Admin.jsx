import { useState, useEffect, useCallback } from 'react'
import { listFiles, fetchFile, saveFile, deleteFile, testConnection } from '../lib/github.js'
import { toDirectUrl } from '../lib/photos.js'

// ─── Auth helpers ──────────────────────────────────────────────────────────────

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const getCfg    = () => { try { return JSON.parse(localStorage.getItem('adm_cfg') || 'null') } catch { return null } }
const saveCfg   = v  => localStorage.setItem('adm_cfg', JSON.stringify(v))
const getToken  = () => localStorage.getItem('adm_tok') || ''
const saveToken = v  => localStorage.setItem('adm_tok', v)
const isSession = () => sessionStorage.getItem('adm_s') === '1'
const startSess = () => sessionStorage.setItem('adm_s', '1')
const endSess   = () => sessionStorage.removeItem('adm_s')

// ─── Markdown helpers ──────────────────────────────────────────────────────────

function blankPhoto() {
  return { title: '', date: '', location: '', tags: '', dropbox: '', video: '', videoPoster: '', videoLoop: false, featured: false, body: '' }
}

function parseMd(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)/)
  if (!m) return blankPhoto()
  const d = {}
  m[1].split('\n').forEach(line => {
    if (!line.trim() || line.startsWith('#')) return
    const i = line.indexOf(':')
    if (i < 0) return
    const k = line.slice(0, i).trim()
    const v = line.slice(i + 1).trim()
    if (!k) return
    if      (v === 'true')       d[k] = true
    else if (v === 'false')      d[k] = false
    else if (v.startsWith('['))  { try { d[k] = JSON.parse(v.replace(/'/g, '"')) } catch { d[k] = [] } }
    else                         d[k] = v.replace(/^["']|["']$/g, '')
  })
  return {
    title:       d.title       || '',
    date:        d.date        || '',
    location:    d.location    || '',
    tags:        Array.isArray(d.tags) ? d.tags.join(', ') : '',
    dropbox:     d.dropbox     || '',
    video:       d.video       || '',
    videoPoster: d.videoPoster || '',
    videoLoop:   !!d.videoLoop,
    featured:    !!d.featured,
    body: m[2].trim(),
  }
}

function toMd({ title, date, location, tags, dropbox, video, videoPoster, videoLoop, featured, body }) {
  const tagArr = tags.split(',').map(t => t.trim()).filter(Boolean)
  const lines = [
    `title: "${title}"`,
    date        ? `date: ${date}`             : null,
    location    ? `location: "${location}"`   : null,
    `tags: [${tagArr.map(t => `"${t}"`).join(', ')}]`,
    dropbox     ? `dropbox: "${dropbox}"`     : null,
    video       ? `video: "${video}"`         : null,
    videoPoster ? `videoPoster: "${videoPoster}"` : null,
    videoLoop   ? 'videoLoop: true'           : null,
    featured    ? 'featured: true'            : null,
  ].filter(Boolean)
  return `---\n${lines.join('\n')}\n---\n${body ? '\n' + body + '\n' : ''}`
}

// ─── Shared UI atoms ───────────────────────────────────────────────────────────

function Field({ label, note, textarea, rows = 5, ...props }) {
  return (
    <div className="adm-field">
      {label && <label className="adm-label">{label}</label>}
      {textarea
        ? <textarea className="adm-input adm-textarea" rows={rows} {...props} />
        : <input    className="adm-input" {...props} />
      }
      {note && <span className="adm-note">{note}</span>}
    </div>
  )
}

function Msg({ err, ok }) {
  if (err) return <p className="adm-err">{err}</p>
  if (ok)  return <p className="adm-ok">{ok}</p>
  return null
}

// ─── Setup (first run) ─────────────────────────────────────────────────────────

function Setup({ onDone }) {
  const [f, setF] = useState({ email: 'budaloco@gmail.com', password: '', token: '', owner: '', repo: '', branch: 'main' })
  const [msg, setMsg]   = useState({})
  const [busy, setBusy] = useState(false)
  const upd = k => e => setF(p => ({ ...p, [k]: e.target.value }))

  const submit = async (ev) => {
    ev.preventDefault()
    if (!f.email || !f.password || !f.token || !f.owner || !f.repo) {
      setMsg({ err: 'All fields are required.' }); return
    }
    setBusy(true); setMsg({})
    try {
      saveCfg({ email: f.email, passwordHash: await sha256(f.password), owner: f.owner, repo: f.repo, branch: f.branch || 'main' })
      saveToken(f.token)
      await testConnection()
      onDone()
    } catch (e) { setMsg({ err: e.message }) }
    setBusy(false)
  }

  return (
    <div className="adm-center">
      <form className="adm-card" onSubmit={submit}>
        <h1 className="adm-title">Admin setup</h1>
        <p className="adm-sub">First-time setup — credentials stay in your browser only.</p>
        <Msg {...msg} />
        <Field label="Admin email"    value={f.email}    onChange={upd('email')}    type="email" />
        <Field label="Admin password" value={f.password} onChange={upd('password')} type="password" autoFocus />
        <Field label="GitHub Personal Access Token" value={f.token} onChange={upd('token')} type="password"
          note="Create at GitHub → Settings → Developer settings → Personal access tokens. Needs 'Contents: write'." />
        <Field label="GitHub owner (username or org)" value={f.owner} onChange={upd('owner')} placeholder="e.g. budaloco" />
        <Field label="GitHub repo name" value={f.repo} onChange={upd('repo')} placeholder="e.g. streetph" />
        <Field label="Branch" value={f.branch} onChange={upd('branch')} />
        <button className="adm-btn adm-btn--primary adm-btn--full" disabled={busy}>
          {busy ? 'Connecting…' : 'Save and log in'}
        </button>
      </form>
    </div>
  )
}

// ─── Login ─────────────────────────────────────────────────────────────────────

function Login({ onDone }) {
  const [email, setEmail] = useState('')
  const [pass,  setPass]  = useState('')
  const [msg,   setMsg]   = useState({})
  const [busy,  setBusy]  = useState(false)

  const submit = async (ev) => {
    ev.preventDefault()
    setBusy(true); setMsg({})
    try {
      const c = getCfg()
      if (!c) throw new Error('Not configured.')
      if (email !== c.email || await sha256(pass) !== c.passwordHash) throw new Error('Invalid credentials.')
      startSess()
      onDone()
    } catch (e) { setMsg({ err: e.message }) }
    setBusy(false)
  }

  const cfg = getCfg()

  return (
    <div className="adm-center">
      <form className="adm-card" onSubmit={submit}>
        <h1 className="adm-title">Admin</h1>
        <p className="adm-sub">{cfg?.owner}/{cfg?.repo}</p>
        <Msg {...msg} />
        <Field label="Email"    value={email} onChange={e => setEmail(e.target.value)} type="email" autoFocus />
        <Field label="Password" value={pass}  onChange={e => setPass(e.target.value)}  type="password" />
        <button className="adm-btn adm-btn--primary adm-btn--full" disabled={busy}>
          {busy ? '…' : 'Log in'}
        </button>
      </form>
    </div>
  )
}

// ─── Photos tab ────────────────────────────────────────────────────────────────

function PhotosTab() {
  const [list,    setList]    = useState(null)
  const [thumbs,  setThumbs]  = useState({})
  const [editing, setEditing] = useState(null)
  const [msg,     setMsg]     = useState({})
  const [busy,    setBusy]    = useState(false)

  const load = useCallback(async () => {
    setMsg({})
    try {
      const files = await listFiles('photos')
      const photoFiles = files
        .filter(f => f.name.endsWith('.md') && f.name !== '_template.md')
        .sort((a, b) => b.name.localeCompare(a.name))
      setList(photoFiles)

      // Load thumbnails in parallel via public download_url (no extra auth calls)
      photoFiles.forEach(async (file) => {
        try {
          const res = await fetch(file.download_url)
          const raw = await res.text()
          const thumb = toDirectUrl(parseMd(raw).dropbox)
          if (thumb) setThumbs(prev => ({ ...prev, [file.path]: thumb }))
        } catch {}
      })
    } catch (e) { setMsg({ err: e.message }) }
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = async (file) => {
    setBusy(true); setMsg({})
    try {
      const { content, sha } = await fetchFile(file.path)
      setEditing({ slug: file.name.replace('.md', ''), sha, fields: parseMd(content), isNew: false, path: file.path })
    } catch (e) { setMsg({ err: e.message }) }
    setBusy(false)
  }

  const openNew = () => {
    const slug = `${String(Date.now()).slice(-6)}-new-photo`
    setEditing({ slug, sha: null, fields: blankPhoto(), isNew: true, path: `photos/${slug}.md` })
  }

  const handleSave = async ({ slug, sha, fields, isNew }) => {
    setBusy(true); setMsg({})
    try {
      const path    = `photos/${slug}.md`
      const content = toMd(fields)
      await saveFile(path, content, sha, `admin: ${isNew ? 'create' : 'update'} ${slug}`)
      setEditing(null)
      load()
    } catch (e) { setMsg({ err: e.message }) }
    setBusy(false)
  }

  const handleDelete = async (file) => {
    if (!confirm(`Delete ${file.name}? This cannot be undone.`)) return
    setBusy(true); setMsg({})
    try {
      await deleteFile(file.path, file.sha, `admin: delete ${file.name}`)
      load()
    } catch (e) { setMsg({ err: e.message }) }
    setBusy(false)
  }

  if (editing) {
    return (
      <PhotoEditor
        editing={editing}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
        busy={busy}
        msg={msg}
      />
    )
  }

  return (
    <div className="adm-pane">
      <div className="adm-pane-header">
        <h2>Photos</h2>
        <button className="adm-btn adm-btn--primary" onClick={openNew} disabled={busy}>+ New photo</button>
      </div>
      <Msg {...msg} />
      {!list && !msg.err && <p className="adm-sub">Loading…</p>}
      {list && list.length === 0 && <p className="adm-sub">No photos yet.</p>}
      {list && (
        <div className="adm-list">
          {list.map(file => (
            <div key={file.sha} className="adm-list-row">
              <div className="adm-thumb">
                {thumbs[file.path] && <img src={thumbs[file.path]} alt="" />}
              </div>
              <code className="adm-filename">{file.name}</code>
              <div className="adm-list-actions">
                <button className="adm-btn adm-btn--sm" onClick={() => openEdit(file)} disabled={busy}>Edit</button>
                <button className="adm-btn adm-btn--sm adm-btn--danger" onClick={() => handleDelete(file)} disabled={busy}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PhotoEditor({ editing, onSave, onCancel, busy, msg }) {
  const [slug,   setSlug]   = useState(editing.slug)
  const [fields, setFields] = useState(editing.fields)

  const upd = k => e =>
    setFields(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const submit = e => {
    e.preventDefault()
    onSave({ ...editing, slug, fields })
  }

  return (
    <form className="adm-pane" onSubmit={submit}>
      <div className="adm-pane-header">
        <h2>{editing.isNew ? 'New photo' : `Edit: ${editing.slug}`}</h2>
        <div className="adm-btn-row">
          <button type="button" className="adm-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="adm-btn adm-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <Msg {...msg} />

      <div className="adm-grid-2">
        <Field
          label="Filename (slug)"
          value={slug}
          onChange={e => setSlug(e.target.value)}
          readOnly={!editing.isNew}
          note={editing.isNew ? 'e.g. 011-street-night (no .md extension)' : 'Cannot rename existing files'}
        />
        <Field label="Title" value={fields.title} onChange={upd('title')} />
        <Field label="Date"  value={fields.date}  onChange={upd('date')} type="date" />
        <Field label="Location" value={fields.location} onChange={upd('location')} />
      </div>

      <Field label="Tags (comma-separated)" value={fields.tags} onChange={upd('tags')} note='e.g. street, night, color' />
      <Field label="Dropbox photo URL" value={fields.dropbox} onChange={upd('dropbox')}
        note="Paste the share link — it will be auto-converted to a direct URL at build time" />
      {fields.dropbox && (
        <div className="adm-preview">
          <img src={toDirectUrl(fields.dropbox)} alt="Preview" className="adm-preview-img" />
        </div>
      )}

      <div className="adm-grid-2">
        <Field label="Video URL (optional)" value={fields.video} onChange={upd('video')} />
        <Field label="Video poster URL (optional)" value={fields.videoPoster} onChange={upd('videoPoster')} />
      </div>

      <div className="adm-checkrow">
        <label><input type="checkbox" checked={fields.videoLoop} onChange={upd('videoLoop')} /> Loop video</label>
        <label><input type="checkbox" checked={fields.featured}  onChange={upd('featured')}  /> Featured</label>
      </div>

      <Field
        label="Body text (markdown) — appears as sticky note preview and in lightbox"
        textarea
        rows={6}
        value={fields.body}
        onChange={upd('body')}
        placeholder="Optional short text or poem…"
      />
    </form>
  )
}

// ─── Bio tab ───────────────────────────────────────────────────────────────────

function BioTab() {
  const [content, setContent] = useState('')
  const [sha,     setSha]     = useState(null)
  const [msg,     setMsg]     = useState({})
  const [busy,    setBusy]    = useState(false)

  useEffect(() => {
    fetchFile('src/content/bio.md')
      .then(({ content, sha }) => { setContent(content); setSha(sha) })
      .catch(e => setMsg({ err: e.message }))
  }, [])

  const save = async (ev) => {
    ev.preventDefault()
    setBusy(true); setMsg({})
    try {
      await saveFile('src/content/bio.md', content + '\n', sha, 'admin: update bio')
      const r = await fetchFile('src/content/bio.md')
      setSha(r.sha)
      setMsg({ ok: 'Saved — site will rebuild in ~2 min.' })
    } catch (e) { setMsg({ err: e.message }) }
    setBusy(false)
  }

  return (
    <form className="adm-pane" onSubmit={save}>
      <div className="adm-pane-header">
        <h2>Bio text</h2>
        <button type="submit" className="adm-btn adm-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <Msg {...msg} />
      <Field
        label="Bio (plain text — markdown links supported: [text](url))"
        textarea
        rows={8}
        value={content}
        onChange={e => setContent(e.target.value)}
      />
    </form>
  )
}

// ─── Contact tab ───────────────────────────────────────────────────────────────

function ContactTab() {
  const [data,  setData]  = useState(null)
  const [sha,   setSha]   = useState(null)
  const [msg,   setMsg]   = useState({})
  const [busy,  setBusy]  = useState(false)

  useEffect(() => {
    fetchFile('src/content/contact.json')
      .then(({ content, sha }) => { setData(JSON.parse(content)); setSha(sha) })
      .catch(e => setMsg({ err: e.message }))
  }, [])

  const setPath = (path, value) => setData(prev => {
    const keys = path.split('.')
    const next = structuredClone(prev)
    let obj = next
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]]
    obj[keys[keys.length - 1]] = value
    return next
  })

  const save = async (ev) => {
    ev.preventDefault()
    setBusy(true); setMsg({})
    try {
      await saveFile('src/content/contact.json', JSON.stringify(data, null, 2) + '\n', sha, 'admin: update contact')
      const r = await fetchFile('src/content/contact.json')
      setSha(r.sha)
      setMsg({ ok: 'Saved — site will rebuild in ~2 min.' })
    } catch (e) { setMsg({ err: e.message }) }
    setBusy(false)
  }

  if (!data && !msg.err) return <p className="adm-sub">Loading…</p>

  return (
    <form className="adm-pane" onSubmit={save}>
      <div className="adm-pane-header">
        <h2>Contact details</h2>
        <button type="submit" className="adm-btn adm-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <Msg {...msg} />
      {data && (
        <>
          <Field label="Email" value={data.email} onChange={e => setPath('email', e.target.value)} type="email" />
          <div className="adm-grid-2">
            <Field label="Instagram handle (with @)" value={data.instagram?.handle} onChange={e => setPath('instagram.handle', e.target.value)} />
            <Field label="Instagram URL" value={data.instagram?.url} onChange={e => setPath('instagram.url', e.target.value)} />
            <Field label="LinkedIn handle" value={data.linkedin?.handle} onChange={e => setPath('linkedin.handle', e.target.value)} />
            <Field label="LinkedIn URL"  value={data.linkedin?.url}  onChange={e => setPath('linkedin.url', e.target.value)} />
          </div>
        </>
      )}
    </form>
  )
}

// ─── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab({ onLogout }) {
  const cfg = getCfg()

  // Playlist
  const [playlist, setPlaylist] = useState('')
  const [plSha,    setPlSha]    = useState(null)

  // GitHub token
  const [tokenVal, setTokenVal] = useState(getToken())

  // Change password
  const [pw, setPw] = useState({ old: '', new1: '', new2: '' })

  const [msg,  setMsg]  = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchFile('src/content/playlist.json')
      .then(({ content, sha }) => { setPlaylist(JSON.parse(content).id); setPlSha(sha) })
      .catch(() => {})
  }, [])

  const savePlaylist = async (ev) => {
    ev.preventDefault()
    setBusy(true); setMsg({})
    try {
      const content = JSON.stringify({ id: playlist }, null, 2) + '\n'
      await saveFile('src/content/playlist.json', content, plSha, 'admin: update playlist')
      const r = await fetchFile('src/content/playlist.json')
      setPlSha(r.sha)
      setMsg({ ok: 'Playlist saved.' })
    } catch (e) { setMsg({ err: e.message }) }
    setBusy(false)
  }

  const saveGHToken = (ev) => {
    ev.preventDefault()
    saveToken(tokenVal)
    setMsg({ ok: 'GitHub token updated.' })
  }

  const changePassword = async (ev) => {
    ev.preventDefault()
    setMsg({})
    if (pw.new1 !== pw.new2) { setMsg({ err: 'New passwords do not match.' }); return }
    if (pw.new1.length < 8)  { setMsg({ err: 'Password must be at least 8 characters.' }); return }
    setBusy(true)
    try {
      if (await sha256(pw.old) !== cfg.passwordHash) throw new Error('Current password is incorrect.')
      saveCfg({ ...cfg, passwordHash: await sha256(pw.new1) })
      setPw({ old: '', new1: '', new2: '' })
      setMsg({ ok: 'Password changed.' })
    } catch (e) { setMsg({ err: e.message }) }
    setBusy(false)
  }

  return (
    <div className="adm-pane">
      <div className="adm-pane-header">
        <h2>Settings</h2>
        <button className="adm-btn adm-btn--danger" onClick={onLogout}>Log out</button>
      </div>
      <Msg {...msg} />

      <section className="adm-section">
        <h3 className="adm-section-title">Music playlist</h3>
        <form onSubmit={savePlaylist}>
          <Field
            label="YouTube Playlist ID"
            value={playlist}
            onChange={e => setPlaylist(e.target.value)}
            note="The ID from the YouTube playlist URL (the part after 'list=')"
          />
          <button type="submit" className="adm-btn adm-btn--primary" disabled={busy}>Save playlist</button>
        </form>
      </section>

      <section className="adm-section">
        <h3 className="adm-section-title">GitHub token</h3>
        <form onSubmit={saveGHToken}>
          <Field
            label="Personal Access Token"
            value={tokenVal}
            onChange={e => setTokenVal(e.target.value)}
            type="password"
            note="Stored in your browser only. Requires 'Contents: write' scope."
          />
          <button type="submit" className="adm-btn adm-btn--primary">Update token</button>
        </form>
      </section>

      <section className="adm-section">
        <h3 className="adm-section-title">Change password</h3>
        <form onSubmit={changePassword}>
          <Field label="Current password" value={pw.old}  onChange={e => setPw(p => ({...p, old:  e.target.value}))} type="password" />
          <Field label="New password"     value={pw.new1} onChange={e => setPw(p => ({...p, new1: e.target.value}))} type="password" />
          <Field label="Confirm new"      value={pw.new2} onChange={e => setPw(p => ({...p, new2: e.target.value}))} type="password" />
          <button type="submit" className="adm-btn adm-btn--primary" disabled={busy}>Change password</button>
        </form>
      </section>

      <section className="adm-section adm-section--info">
        <h3 className="adm-section-title">Repo</h3>
        <p className="adm-sub" style={{ margin: 0 }}>
          {cfg?.owner}/{cfg?.repo} · branch: <strong>{cfg?.branch}</strong>
        </p>
        <p className="adm-sub" style={{ marginTop: '0.75rem' }}>
          Changes commit to GitHub and go live after GitHub Actions rebuilds the site (~2 min).
          Make sure you have a deploy workflow — see the <em>GitHub Actions</em> note below.
        </p>
        <pre className="adm-pre">{`# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist`}</pre>
      </section>
    </div>
  )
}

// ─── Dashboard shell ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'photos',  label: 'Photos'  },
  { id: 'bio',     label: 'Bio'     },
  { id: 'contact', label: 'Contact' },
  { id: 'settings',label: 'Settings'},
]

function Dashboard({ onLogout }) {
  const [tab, setTab] = useState('photos')
  const cfg = getCfg()

  return (
    <div className="adm-dashboard">
      <nav className="adm-nav">
        <span className="adm-nav-brand">Admin</span>
        <div className="adm-nav-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`adm-tab${tab === t.id ? ' adm-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <a href="#/" className="adm-back-link">← Back to site</a>
      </nav>

      <div className="adm-body">
        {tab === 'photos'   && <PhotosTab />}
        {tab === 'bio'      && <BioTab />}
        {tab === 'contact'  && <ContactTab />}
        {tab === 'settings' && <SettingsTab onLogout={onLogout} />}
      </div>
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function Admin() {
  const [view, setView] = useState(() => {
    if (!getCfg())    return 'setup'
    if (isSession())  return 'dashboard'
    return 'login'
  })

  const onSetupDone = () => { startSess(); setView('dashboard') }
  const onLoginDone = () => { startSess(); setView('dashboard') }
  const onLogout    = () => { endSess();   setView('login') }

  return (
    <div className="adm-root">
      {view === 'setup'     && <Setup     onDone={onSetupDone} />}
      {view === 'login'     && <Login     onDone={onLoginDone} />}
      {view === 'dashboard' && <Dashboard onLogout={onLogout}  />}
    </div>
  )
}

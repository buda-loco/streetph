// GitHub Contents API wrapper — used by the admin panel.
// Config and token are stored in localStorage so nothing is hardcoded.

const GH = 'https://api.github.com'

function cfg() {
  try { return JSON.parse(localStorage.getItem('adm_cfg') || 'null') } catch { return null }
}

function tok() { return localStorage.getItem('adm_tok') || '' }

function headers() {
  return {
    Authorization: `Bearer ${tok()}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github.v3+json',
  }
}

// UTF-8 safe encode/decode (btoa only works for latin1)
function encode(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function ghFetch(method, repoPath, body) {
  const c = cfg()
  if (!c) throw new Error('Admin not configured.')
  const url = `${GH}/repos/${c.owner}/${c.repo}/contents/${repoPath}`
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.message || `GitHub API error ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

// List all files in a directory — returns array of {name, sha, path, ...}
export async function listFiles(dir) {
  return ghFetch('GET', dir)
}

// Fetch a single file — returns {content: string, sha: string}
export async function fetchFile(path) {
  const data = await ghFetch('GET', path)
  return { content: decode(data.content), sha: data.sha }
}

// Create or update a file. Pass sha=null to create, sha=string to update.
export async function saveFile(path, content, sha, message) {
  const c = cfg()
  const body = {
    message,
    content: encode(content),
    branch: c?.branch || 'main',
  }
  if (sha) body.sha = sha
  return ghFetch('PUT', path, body)
}

// Delete a file (requires its current sha)
export async function deleteFile(path, sha, message) {
  const c = cfg()
  const url = `${GH}/repos/${c.owner}/${c.repo}/contents/${path}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: headers(),
    body: JSON.stringify({ message, sha, branch: c?.branch || 'main' }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.message || `GitHub API error ${res.status}`)
  }
}

// Test that the token and repo are valid
export async function testConnection() {
  const c = cfg()
  if (!c) throw new Error('Not configured')
  const res = await fetch(`${GH}/repos/${c.owner}/${c.repo}`, { headers: headers() })
  if (!res.ok) throw new Error(`Cannot access repo (${res.status}) — check token and repo name`)
  return res.json()
}

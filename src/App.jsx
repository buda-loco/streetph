import { useState, useEffect, useRef } from 'react'
import Nav         from './components/Nav.jsx'
import Footer      from './components/Footer.jsx'
import Preloader   from './components/Preloader.jsx'
import MiniPlayer  from './components/MiniPlayer.jsx'
import MusicModal  from './components/MusicModal.jsx'
import Gallery     from './pages/Gallery.jsx'
import About       from './pages/About.jsx'
import Contact     from './pages/Contact.jsx'
import { loadPhotos } from './lib/photos.js'

const photos = loadPhotos()

function useHash() {
  const [hash, setHash] = useState(window.location.hash || '#/')
  useEffect(() => {
    const h = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  return hash.replace('#', '') || '/'
}

export default function App() {
  const route        = useHash()

  const [ready,      setReady]     = useState(false)
  const [showModal,  setShowModal] = useState(false)
  const miniPlayerRef = useRef(null)
  const prevRoute    = useRef(route)
  const [pageKey,    setPageKey]   = useState(0)

  // Show music toast after the bio note has had time to pop in and be read
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => setShowModal(true), 4200)
    return () => clearTimeout(t)
  }, [ready])

  // Bump key to re-trigger fade animation on navigation
  useEffect(() => {
    if (prevRoute.current !== route) {
      prevRoute.current = route
      setPageKey(k => k + 1)
    }
  }, [route])

  return (
    <div className="app">
      {!ready && <Preloader onDone={() => setReady(true)} />}
      <Nav />
      <MiniPlayer ref={miniPlayerRef} />
      {showModal && (
        <MusicModal
          onYes={() => {
            // Call synchronously inside the click handler — preserves
            // the user gesture context that YouTube requires for playVideo()
            miniPlayerRef.current?.play()
            setShowModal(false)
          }}
          onNo={() => setShowModal(false)}
        />
      )}
      <main key={pageKey} className="page-fade">
        {route === '/'        && <Gallery photos={photos} />}
        {route === '/about'   && <About />}
        {route === '/contact' && <Contact />}
      </main>
      {route !== '/' && <Footer />}
    </div>
  )
}

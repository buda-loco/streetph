import { useState, useEffect } from 'react'
import Nav     from './components/Nav.jsx'
import Footer  from './components/Footer.jsx'
import Gallery from './pages/Gallery.jsx'
import About   from './pages/About.jsx'
import Contact from './pages/Contact.jsx'
import { loadPhotos } from './lib/photos.js'

// Load once at module level — photos are static
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
  const route = useHash()

  return (
    <div className="app">
      <Nav />
      <main>
        {route === '/'        && <Gallery photos={photos} />}
        {route === '/about'   && <About />}
        {route === '/contact' && <Contact />}
      </main>
      {route !== '/' && <Footer />}
    </div>
  )
}

export default function Nav() {
  return (
    <header className="nav">
      <a href="#/" className="nav-logo">Ben Arnedo</a>
      <nav className="nav-links">
        <a href="#/">Work</a>
        <a href="#/about">About</a>
        <a href="#/contact">Contact</a>
      </nav>
      <div className="nav-socials">
        <a href="https://instagram.com/benarnedo" target="_blank" rel="noopener noreferrer">
          Instagram
        </a>
        <a href="https://www.linkedin.com/in/benjaminarnedo/" target="_blank" rel="noopener noreferrer">
          LinkedIn
        </a>
      </div>
    </header>
  )
}

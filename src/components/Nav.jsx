import Logo from './Logo'

export default function Nav() {
  return (
    <header className="nav">
      <a href="#/" className="nav-logo" aria-label="Ben Arnedo">
        <Logo className="nav-logo-svg" />
      </a>
      <nav className="nav-links">
        <a href="#/"><i className="lni lni-briefcase" /><span>Work</span></a>
        <a href="#/about"><i className="lni lni-user" /><span>About</span></a>
        <a href="#/contact"><i className="lni lni-envelope" /><span>Contact</span></a>
      </nav>
      <div className="nav-socials">
        <a href="https://instagram.com/benarnedo" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          <i className="lni lni-instagram-original" /><span>Instagram</span>
        </a>
        <a href="https://www.linkedin.com/in/benjaminarnedo/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
          <i className="lni lni-linkedin-original" /><span>LinkedIn</span>
        </a>
      </div>
    </header>
  )
}

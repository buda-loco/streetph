const SOCIALS = [
  { label: 'Instagram', handle: '@benarnedo',      href: 'https://instagram.com/benarnedo' },
  { label: 'LinkedIn',  handle: 'benjaminarnedo',  href: 'https://www.linkedin.com/in/benjaminarnedo/' },
]

export default function Contact() {
  return (
    <section className="inner-page">
      <div className="inner-page-content">
        <p className="page-label">Contact</p>

        <a href="mailto:hello@benjaminarnedo.com" className="contact-email">
          hello@benjaminarnedo.com
        </a>

        <div className="contact-socials">
          {SOCIALS.map(s => (
            <a key={s.label} href={s.href}
               target="_blank" rel="noopener noreferrer"
               className="contact-social-row">
              <span className="social-label">{s.label}</span>
              <span className="social-handle">{s.handle}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

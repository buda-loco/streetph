import contactData from '../content/contact.json'

export default function Contact() {
  const { email, instagram, linkedin } = contactData
  return (
    <section className="inner-page">
      <div className="inner-page-content">
        <p className="page-label">Contact</p>

        <a href={`mailto:${email}`} className="contact-email">
          {email}
        </a>

        <div className="contact-socials">
          {[
            { label: 'Instagram', handle: instagram.handle, href: instagram.url },
            { label: 'LinkedIn',  handle: linkedin.handle,  href: linkedin.url  },
          ].map(s => (
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

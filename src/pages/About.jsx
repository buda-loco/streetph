export default function About() {
  return (
    <section className="inner-page">
      <div className="inner-page-content">
        <p className="page-label">About</p>

        <div className="about-bio">
          <p>
            Ben Arnedo is a street photographer based in Buenos Aires,
            drawn to fleeting moments in the city — the light that lands wrong,
            the glance that lasts half a second too long.
          </p>
          <p>
            He shoots with whatever is nearest. The camera is secondary.
          </p>
        </div>

        <div className="about-links">
          <a href="https://instagram.com/benarnedo"
             target="_blank" rel="noopener noreferrer">
            @benarnedo
          </a>
          <a href="https://www.linkedin.com/in/benjaminarnedo/"
             target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
          <a href="mailto:hello@benjaminarnedo.com">
            hello@benjaminarnedo.com
          </a>
        </div>
      </div>
    </section>
  )
}

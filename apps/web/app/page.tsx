const tastes = [
  { name: "Drama", value: 82 },
  { name: "Thriller", value: 68 },
  { name: "Science-Fiction", value: 51 },
];

export default function Home() {
  return (
    <main>
      <nav>
        <a className="brand" href="#">MOVIEMATCH</a>
        <a className="navLink" href="#so-funktionierts">So funktioniert&apos;s</a>
      </nav>

      <section className="hero">
        <div className="copy">
          <p className="eyebrow">DEIN NÄCHSTER FILM</p>
          <h1>Was schauen wir heute?</h1>
          <p className="intro">
            MovieMatch lernt aus deinem Netflix-Verlauf und findet Filme,
            die wirklich zu deinem Geschmack passen.
          </p>
          <div className="actions">
            <a className="primary" href="#start">Verlauf importieren <span>→</span></a>
            <a className="secondary" href="#so-funktionierts">Mehr erfahren</a>
          </div>
        </div>

        <div className="preview" aria-label="Vorschau des Filmgeschmacks">
          <div className="glow" />
          <article className="tasteCard">
            <div className="cardHeader">
              <div>
                <p className="cardLabel">DEIN PROFIL</p>
                <h2>Filmgeschmack</h2>
              </div>
              <span className="count">48 Titel</span>
            </div>
            <div className="tasteList">
              {tastes.map((taste) => (
                <div className="taste" key={taste.name}>
                  <div className="tasteLabels">
                    <span>{taste.name}</span>
                    <span>{taste.value}%</span>
                  </div>
                  <div className="track">
                    <div className="bar" style={{ width: `${taste.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <button type="button">▶ Film vorschlagen</button>
          </article>
          <div className="matchPill"><span>✦</span> Match gefunden</div>
        </div>
      </section>

      <section className="steps" id="so-funktionierts">
        <p className="eyebrow">GANZ EINFACH</p>
        <h2>Drei Schritte zum Filmabend.</h2>
        <div className="stepGrid">
          <article><span>01</span><h3>Verlauf importieren</h3><p>Lade deine Netflix-Wiedergabehistorie als CSV hoch.</p></article>
          <article><span>02</span><h3>Geschmack erkennen</h3><p>MovieMatch analysiert Genres und Lieblingsfilme lokal.</p></article>
          <article><span>03</span><h3>Film entdecken</h3><p>Erhalte einen Vorschlag, der zu deinem Profil passt.</p></article>
        </div>
      </section>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowRight, Check, Clock3, FileText, History, Menu, ScrollText, ShieldCheck, X } from 'lucide-react';

function DashboardPreview() {
  return (
    <div className="dashboard-wrap" aria-label="Aperçu du tableau de bord Sentinel">
      <div className="dashboard">
        <div className="dashboard-bar">
          <span className="window-dot" /><span className="window-dot" /><span className="window-dot" />
          <span className="mono">sentinel / communauté</span>
        </div>
        <div className="dash-body">
          <aside className="dash-side">
            <p className="side-title display">sentinel</p>
            <div className="side-item active"><ShieldCheck /> Vue d'ensemble</div>
            <div className="side-item"><History /> Historique</div>
            <div className="side-item"><ScrollText /> Journal d'audit</div>
            <div className="side-item"><FileText /> Règles</div>
          </aside>
          <div className="dash-main">
            <h3 className="display">Vue d'ensemble</h3>
            <p className="dash-sub">Les dernières actions de votre équipe de modération.</p>
            <div className="dash-stats">
              <div className="dash-stat"><div className="number">24</div><div className="label">Avertissements</div><div className="stat-bar" /></div>
              <div className="dash-stat"><div className="number">08</div><div className="label">Timeouts actifs</div><div className="stat-bar coral" /></div>
              <div className="dash-stat"><div className="number">96</div><div className="label">Actions ce mois</div><div className="stat-bar mint" /></div>
            </div>
            <div className="dash-log">
              <div className="log-row"><span className="log-time">14:42</span><span className="log-user"><b>avertissement</b> · @nocturne</span><span className="tag">noté</span></div>
              <div className="log-row"><span className="log-time">13:08</span><span className="log-user"><b>timeout</b> · @pixelnoise</span><span className="tag orange">10 min</span></div>
              <div className="log-row"><span className="log-time">hier</span><span className="log-user"><b>règle modifiée</b> · @lina</span><span className="tag">journalisé</span></div>
            </div>
          </div>
        </div>
      </div>
      <div className="floating-chip"><span>ÉTAT DU SERVEUR</span>Tout est sous contrôle</div>
    </div>
  );
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(false), 4800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="site-shell">
      <nav className="container nav" aria-label="Navigation principale">
        <a href="#top" className="brand" data-testid="link-brand" onClick={closeMenu}>
          <span className="brand-mark"><span /></span>
          <span>sentinel</span>
        </a>
        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <a href="#fonctionnalites" data-testid="link-features" onClick={closeMenu}>Fonctionnalités</a>
          <a href="#methode" data-testid="link-method" onClick={closeMenu}>Méthode</a>
          <a href="#contact" data-testid="link-contact" onClick={closeMenu}>Contact</a>
          <button className="nav-cta" type="button" data-testid="button-nav-invite" onClick={() => setNotice(true)}>Inviter Sentinel <ArrowRight size={14} /></button>
        </div>
        <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} data-testid="button-menu" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <section className="container hero" id="top">
        <div className="hero-grid">
          <div>
            <p className="eyebrow mono">Modération nette, communauté sereine</p>
            <h1 className="display">Garder le cap.<br /><em>Ensemble.</em></h1>
            <p className="hero-copy">Sentinel donne aux modérateurs Discord les bons réflexes au bon moment : des avertissements clairs, un historique fiable et un journal que toute l'équipe peut comprendre.</p>
            <div className="hero-actions">
              <button className="button-primary" type="button" data-testid="button-hero-invite" onClick={() => setNotice(true)}>Inviter Sentinel <ArrowRight size={16} /></button>
              <a className="button-ghost" href="#fonctionnalites" data-testid="link-discover">Découvrir l'outil <ArrowDownRight size={16} /></a>
            </div>
            <p className="hero-note">Lien d'invitation en préparation · accès sur demande</p>
          </div>
          <DashboardPreview />
        </div>
      </section>

      <section className="trust-strip" aria-label="Engagements Sentinel">
        <div className="container trust-row">
          <span className="trust-label mono">Pensé pour les équipes qui modèrent</span>
          <div className="trust-items">
            <span><Check size={14} /> Lisible par tous</span>
            <span><Check size={14} /> Historique complet</span>
            <span><Check size={14} /> Sans bruit inutile</span>
          </div>
        </div>
      </section>

      <section className="container section" id="fonctionnalites">
        <div className="features-layout">
          <div>
            <p className="section-kicker mono">01 — Ce qui compte</p>
            <h2 className="section-heading display">Moins de flou.<br /><span>Plus de contexte.</span></h2>
            <p className="section-intro">Quand une situation arrive, l'équipe n'a pas besoin de dix outils. Elle a besoin de savoir quoi faire, pourquoi, et ce qui s'est passé avant.</p>
          </div>
          <div className="feature-list">
            <article className="feature-item">
              <span className="feature-num">01</span>
              <div><h3>Avertissements qui restent utiles</h3><p>Notez le motif, le contexte et la prochaine étape. Chaque avertissement devient un repère, pas une punition oubliée.</p></div>
              <ArrowDownRight size={17} />
            </article>
            <article className="feature-item">
              <span className="feature-num">02</span>
              <div><h3>Timeouts sans ambiguïté</h3><p>Appliquez une durée visible et cohérente. Les règles sont les mêmes pour tous, même quand la discussion s'accélère.</p></div>
              <ArrowDownRight size={17} />
            </article>
            <article className="feature-item">
              <span className="feature-num">03</span>
              <div><h3>Un historique que l'on retrouve</h3><p>Revenez sur le parcours d'un membre en quelques secondes. Les décisions sont documentées, l'équipe avance avec les mêmes faits.</p></div>
              <ArrowDownRight size={17} />
            </article>
            <article className="feature-item">
              <span className="feature-num">04</span>
              <div><h3>Un journal d'audit, vraiment lisible</h3><p>Qui a fait quoi, quand et sur quel membre : les actions importantes ne disparaissent jamais dans le flux.</p></div>
              <ArrowDownRight size={17} />
            </article>
          </div>
        </div>
      </section>

      <section className="dark-panel section" id="methode">
        <div className="container workflow">
          <div>
            <p className="section-kicker mono">02 — La méthode</p>
            <h2 className="section-heading display">Une modération qui <span>se transmet.</span></h2>
            <p className="section-intro">Les bons outils ne remplacent pas le jugement. Ils le rendent partageable, surtout quand les membres de l'équipe se relaient.</p>
          </div>
          <div className="steps">
            <div className="step"><strong>01 / CONSTATER</strong><h3>Le contexte avant la sanction</h3><p>Un signal est enregistré avec les éléments qui ont conduit à l'action, pour éviter les décisions prises à l'aveugle.</p></div>
            <div className="step"><strong>02 / DÉCIDER</strong><h3>Une réponse simple et cohérente</h3><p>Les modérateurs disposent d'un langage commun pour avertir, mettre en timeout ou laisser une note.</p></div>
            <div className="step"><strong>03 / TRANSMETTRE</strong><h3>Une équipe qui garde le fil</h3><p>Le prochain modérateur reprend l'histoire là où elle s'est arrêtée. Pas de mémoire individuelle à deviner.</p></div>
          </div>
        </div>
      </section>

      <section className="container quote-section section">
        <div className="quote-mark">“</div>
        <p className="quote">La confiance ne vient pas de l'absence de problèmes. Elle vient d'une équipe qui sait les gérer.</p>
        <span className="quote-by mono">Sentinel · pour les communautés qui durent</span>
      </section>

      <section className="contact-panel" id="contact">
        <div className="container contact-row">
          <div>
            <h2 className="display">Prêt à reprendre<br />la main ?</h2>
            <p>Le lien d'invitation arrive bientôt. D'ici là, dites-nous ce que vous modérez.</p>
          </div>
          <div className="contact-actions">
            <button className="button-primary" type="button" data-testid="button-contact" onClick={() => setNotice(true)}>Demander un accès <ArrowRight size={16} /></button>
            <span className="disabled-note">Action de démonstration — aucun compte n'est créé</span>
          </div>
        </div>
      </section>

      <footer className="container footer">
        <div className="footer-row">
          <a href="#top" className="brand" data-testid="link-footer-brand"><span className="brand-mark"><span /></span><span>sentinel</span></a>
          <p>Un outil de modération en construction, avec soin.</p>
          <div className="footer-links"><a href="#fonctionnalites" data-testid="link-footer-features">Fonctionnalités</a><a href="#contact" data-testid="link-footer-contact">Nous écrire</a></div>
        </div>
      </footer>

      {notice && <div className="notice" role="status" data-testid="status-invite"><button type="button" aria-label="Fermer" onClick={() => setNotice(false)}>×</button><strong>Invitation bientôt disponible.</strong><br />Sentinel est encore en préparation. Revenez bientôt pour connecter votre serveur.</div>}
    </main>
  );
}

export default App;

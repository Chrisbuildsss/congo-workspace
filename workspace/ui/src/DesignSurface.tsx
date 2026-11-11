import type { DesignKind } from "./types";

function MintSurface() {
  return (
    <div className="surface surface-mint" data-edit-label="Mint Hero">
      <div className="mint-mark" data-edit-label="Mint Mark">
        <span>✣</span>
      </div>
      <section className="mint-copy">
        <p className="mint-eyebrow" data-edit-label="Eyebrow">
          A SMALL MACHINE FOR LARGE IDEAS
        </p>
        <h1 data-edit-label="Headline">
          Introducing
          <br />
          <em>Pine Mint.</em>
        </h1>
        <p className="mint-body" data-edit-label="Body copy">
          Not a figment of your imagination. Pine Mint thinks, drafts your
          memos, organizes your files, and learns how you work. The future of
          personal computing is here.
        </p>
        <div className="mint-buy-row">
          <button type="button" data-edit-label="Primary button">
            Order Pine Mint
          </button>
          <span>$2,495.00</span>
        </div>
        <div className="mint-specs">
          <div>
            <strong>PROCESSOR</strong>
            <span>Neural Engine</span>
          </div>
          <div>
            <strong>MEMORY</strong>
            <span>512K Synapse</span>
          </div>
          <div>
            <strong>STORAGE</strong>
            <span>5.25&quot; Floppy</span>
          </div>
          <div>
            <strong>DISPLAY</strong>
            <span>9&quot; Phosphor</span>
          </div>
        </div>
      </section>
      <div className="mint-machine" aria-label="Illustration of a compact computer">
        <div className="mint-monitor">
          <div className="mint-screen">
            <div className="mint-menu">
              <span>◆ System</span>
              <span>PineOS 1.0</span>
            </div>
            <div className="mint-window">
              <div>Untitled.txt</div>
              <p>Good morning.</p>
              <p>Your memo is drafted.</p>
            </div>
          </div>
          <i className="mint-light" />
        </div>
        <div className="mint-base">
          <span className="mint-floppy" />
          <span className="mint-badge">MACHINE<br />INTELLIGENCE</span>
        </div>
        <div className="mint-keyboard">
          {Array.from({ length: 43 }).map((_, i) => <i key={i} />)}
        </div>
        <span className="mint-star">★</span>
        <span className="mint-flower">✿</span>
      </div>
    </div>
  );
}

function AuraSurface() {
  return (
    <div className="surface surface-aura" data-edit-label="Aura Hero">
      <div className="aura-cloud" />
      <header className="aura-header" data-edit-label="Aura Header">
        <span>LUMEN // SECURE ACCESS</span>
        <span>V03.01</span>
        <button type="button">DARK</button>
      </header>
      <div className="aura-meta">
        <span>SYS.CORE // ON-LINE</span>
        <span>UPLINK_ESTABLISHED_</span>
      </div>
      <div className="aura-login" data-edit-label="Authentication card">
        <p className="aura-kicker">LUMEN.IDENTITY</p>
        <h2>Authenticate</h2>
        <p>Secure bio-metric or credential access.</p>
        <div className="aura-socials">
          <span>●</span>
          <span>◉</span>
          <span>◈</span>
        </div>
        <div className="aura-fields">
          <span>IDENTIFIER</span>
          <i />
          <span>PASSCODE</span>
          <i />
        </div>
        <button type="button">INITIALIZE UPLINK →</button>
      </div>
      <div className="aura-footer">
        <span>SECURE / 256-BIT</span>
        <span>LUMEN INTERFACE 03</span>
      </div>
    </div>
  );
}

function PostSurface() {
  return (
    <div className="surface surface-post" data-edit-label="Post Hotel">
      <header className="post-header" data-edit-label="Hotel header">
        <div>
          <span>EST. 1924</span>
          <span>CEDAR BAY</span>
        </div>
        <div className="post-wordmark">Harbor<br /><em>House</em></div>
        <nav>WALLET&nbsp;&nbsp; GUIDE&nbsp;&nbsp; ROOM&nbsp;&nbsp; 24H</nav>
      </header>
      <main className="post-main">
        <section className="post-intro" data-edit-label="Hotel introduction">
          <span>DIGITAL KEY</span>
          <h2>For quiet days<br />at Harbor House.</h2>
          <p>Cedar Bay · North Coast</p>
        </section>
        <div className="post-card" data-edit-label="Key card">
          <div className="post-card-stripe">CEDAR BAY · HAVE A WONDERFUL STAY ·</div>
          <div className="post-card-center">
            <span>OFFICIAL</span>
            <strong>RECEIPT</strong>
            <b>No. 992</b>
            <div className="post-room">ROOM NO 204</div>
            <button type="button">UNLOCK</button>
          </div>
          <span className="post-card-stamp">✦</span>
        </div>
        <section className="post-service" data-edit-label="Concierge panel">
          <span>CONCIERGE</span>
          <p>Front desk open 24/7.</p>
          <p>Dial 9 for assistance.</p>
          <div className="post-grid">
            <div><b>02</b><span>CHECK-IN</span></div>
            <div><b>04</b><span>CHECK-OUT</span></div>
            <div><b>NET</b><span>HARBORNET</span></div>
          </div>
        </section>
      </main>
    </div>
  );
}

function PortfolioSurface() {
  return (
    <div className="surface surface-portfolio" data-edit-label="Portfolio Hero">
      <header data-edit-label="Portfolio navigation">
        <span>PORTFOLIO 2025</span>
        <nav>WORKS / ABOUT / CONTACT</nav>
        <span>IG / LI / TW</span>
      </header>
      <div className="portfolio-sparkles" aria-hidden="true">
        <i>✦</i><i>✺</i><i>✦</i><i>✺</i>
      </div>
      <p className="portfolio-kicker">CREATIVE DEVELOPER BASED IN LISBON</p>
      <h1 data-edit-label="Portfolio headline">
        juli <i>e</i>
      </h1>
      <div className="portfolio-bottom">
        <span>AVAILABLE FOR FREELANCE</span>
        <span>↓ SCROLL</span>
        <span>© 2025 JULI</span>
      </div>
    </div>
  );
}

function ArchiveSurface({ detail = false }: { detail?: boolean }) {
  return (
    <div className="surface surface-archive" data-edit-label="Archive Hero">
      <header data-edit-label="Archive header">
        <b>ARCHIV_01</b>
        <span>● &nbsp; MENU</span>
      </header>
      <div className="archive-hero">
        <div className="archive-window" />
        <h1 data-edit-label="Headline">
          VISUAL
          <br />
          JOURNAL
        </h1>
        {!detail && (
          <div className="archive-pills">
            <span>Index</span><span>Thoughts</span><span>Archive</span><span>Connect</span>
          </div>
        )}
      </div>
      <div className="archive-meta" data-edit-label="Project metadata">
        <div><span>LOCATION</span><b>BERLIN / 52.5200° N</b></div>
        <div><span>STATUS</span><b><i /> ACTIVE ARCHIVE</b></div>
        <div><span>UPDATED</span><b>OCT 24, 2024</b></div>
      </div>
    </div>
  );
}

function SignalSurface() {
  return (
    <div className="surface surface-signal" data-edit-label="Signal Editorial">
      <div className="signal-orb signal-orb-one" />
      <div className="signal-orb signal-orb-two" />
      <header>
        <span>SIGNAL / NOTES</span>
        <span>ISSUE 004</span>
        <span>JULY 2025</span>
      </header>
      <main>
        <span className="signal-kicker" data-edit-label="Issue label">A quiet dispatch about loud ideas</span>
        <h1 data-edit-label="Headline">The shape of<br /><em>attention.</em></h1>
        <p data-edit-label="Deck">
          Notes on craft, interface culture, and making room for work that
          deserves a second look.
        </p>
        <div className="signal-rule" />
        <div className="signal-articles">
          <article><span>01</span><b>The useful pause</b><small>4 min</small></article>
          <article><span>02</span><b>Interfaces with memory</b><small>7 min</small></article>
          <article><span>03</span><b>A softer kind of speed</b><small>5 min</small></article>
        </div>
      </main>
    </div>
  );
}

function FolioSurface() {
  return (
    <div className="surface surface-folio" data-edit-label="Folio Hero">
      <div className="folio-nav">
        <span>NOVA / STUDIO</span>
        <nav>WORK&nbsp;&nbsp; NOTES&nbsp;&nbsp; INFO</nav>
      </div>
      <div className="folio-frame" data-edit-label="Portrait frame">
        <div className="folio-head" />
        <div className="folio-body" />
      </div>
      <h1 data-edit-label="Headline">A study in<br /><em>presence.</em></h1>
      <p className="folio-note" data-edit-label="Caption">Independent designer<br />working across screen + space.</p>
      <div className="folio-stamp">2025<br />SELECTED<br />WORKS</div>
    </div>
  );
}

function GridSurface() {
  return (
    <div className="surface surface-grid" data-edit-label="Kinetic Grid">
      <header>
        <b>STUDIO 44</b>
        <span>STUDIO<br />SYSTEMS</span>
        <span>MENU +</span>
      </header>
      <h1 data-edit-label="Headline">Build for<br /><em>what’s next.</em></h1>
      <div className="grid-tiles">
        <div className="grid-tile grid-tile-lime"><b>01</b><span>Strategy</span></div>
        <div className="grid-tile grid-tile-pink"><b>02</b><span>Identity</span></div>
        <div className="grid-tile grid-tile-blue"><b>03</b><span>Product</span></div>
        <div className="grid-tile grid-tile-dark"><b>04</b><span>Systems</span></div>
      </div>
    </div>
  );
}

export default function DesignSurface({
  kind,
  detail = false,
}: {
  kind: DesignKind;
  detail?: boolean;
}) {
  switch (kind) {
    case "mint":
      return <MintSurface />;
    case "aura":
      return <AuraSurface />;
    case "post":
      return <PostSurface />;
    case "portfolio":
      return <PortfolioSurface />;
    case "archive":
      return <ArchiveSurface detail={detail} />;
    case "signal":
      return <SignalSurface />;
    case "folio":
      return <FolioSurface />;
    case "grid":
      return <GridSurface />;
  }
}

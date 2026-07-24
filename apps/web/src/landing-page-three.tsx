import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, Braces, Code2, Database, Globe2, HardDrive, MonitorUp, Network, Send, Server, ShieldCheck, Sparkles, Terminal, UsersRound } from "lucide-react";
import "./landing-page-three.css";

type LandingPageThreeProps = {
  currentLandingUrl: string;
  docsUrl: string;
  driveUrl: string;
  loginUrl: string;
  logoCloudUrl: string;
  logoPegasusUrl: string;
};

type Dot = {
  x: number;
  y: number;
  originX: number;
  originY: number;
  velocityX: number;
  velocityY: number;
  energy: number;
};

type TrailPoint = {
  x: number;
  y: number;
  createdAt: number;
};

const products = [
  {
    name: "Zo Paste",
    category: "Private notes and code",
    description: "Publish one precise note without exposing the folder it came from.",
    highlights: [
      ["Markdown and code", "Create clean, formatted notes and syntax-aware snippets."],
      ["View or edit access", "Choose whether recipients can read or collaborate."],
      ["Isolated sharing", "Expose the paste without revealing its source folder."]
    ],
    outcome: "Share only the note you intend",
    section: "pastes",
    icon: Code2,
    symbol: "P",
    gradient: "linear-gradient(135deg,#ff4f87 0%,#7b36ff 48%,#1429ff 100%)"
  },
  {
    name: "Zo Transfer",
    category: "Controlled file delivery",
    description: "Send large files with passcodes, expiry and revoke controls.",
    highlights: [
      ["Large-file delivery", "Package and deliver files without moving them to another SaaS."],
      ["Passcodes and expiry", "Set who can open a transfer and how long it remains available."],
      ["Instant revocation", "Withdraw a live transfer when access should end."]
    ],
    outcome: "Deliver files without surrendering control",
    section: "transfer",
    icon: Send,
    symbol: "T",
    gradient: "linear-gradient(135deg,#ffcf27 0%,#ff6b24 48%,#e6004c 100%)"
  },
  {
    name: "Zo Functions",
    category: "Private automation",
    description: "Run JavaScript and Python beside the files and data they serve.",
    highlights: [
      ["JavaScript and Python", "Build automations in the language that fits the job."],
      ["Local data access", "Run logic beside your Drive files and private databases."],
      ["Run history", "Inspect executions and outcomes from the same workspace."]
    ],
    outcome: "Automate beside the data",
    section: "functions",
    icon: Braces,
    symbol: "F",
    gradient: "linear-gradient(135deg,#d9ff3f 0%,#31d787 48%,#008d8a 100%)"
  },
  {
    name: "Zo Databases",
    category: "Persistent data runtimes",
    description: "Create private databases and issue scoped credentials from one place.",
    highlights: [
      ["Multiple engines", "Use SQLite, DuckDB, libSQL and other local data runtimes."],
      ["Tables and queries", "Inspect data, browse rows and run queries from Zo Drive."],
      ["Scoped credentials", "Issue access for the specific database a client needs."]
    ],
    outcome: "Run data where it belongs",
    section: "databases",
    icon: Database,
    symbol: "D",
    gradient: "linear-gradient(135deg,#54e3ff 0%,#1685ff 50%,#3835bd 100%)"
  },
  {
    name: "Zo Shared Drives",
    category: "Source-owned collaboration",
    description: "Mount selected live folders while ownership stays with the source Zo.",
    highlights: [
      ["Live folder mounts", "Collaborate on selected folders without copying the source."],
      ["Source-owned storage", "The originating Zo remains the authoritative system of record."],
      ["Member permissions", "Grant collaboration only to the people who need it."]
    ],
    outcome: "Collaborate without moving the source",
    section: "cluster-databases",
    icon: Network,
    symbol: "S",
    gradient: "linear-gradient(135deg,#ff92e0 0%,#ee3d9d 48%,#792ad7 100%)"
  },
  {
    name: "ZominAI",
    category: "Local Drive intelligence",
    description: "Ask questions across current Drive context with authenticated read-only tools.",
    highlights: [
      ["Drive-aware answers", "Ask questions using the files and data already on your Zo."],
      ["Read-only tools", "Let AI inspect context without granting it write authority."],
      ["Private local context", "Keep retrieval beside the workspace it understands."]
    ],
    outcome: "Ask your Drive without granting write access",
    section: "zominai",
    icon: Bot,
    symbol: "AI",
    gradient: "linear-gradient(135deg,#ff7a21 0%,#d638c9 46%,#5634d7 100%)"
  }
] as const;

const teamFeatures = [
  { icon: Network, title: "Mount live folders", copy: "Invite collaborators into selected folders while the source Zo remains authoritative.", accent: "#5fe7ff" },
  { icon: Send, title: "Deliver with intent", copy: "Add passcodes, expiry and revocation to every transfer link.", accent: "#ff8a3d" },
  { icon: Code2, title: "Publish one note", copy: "Create a focused view-only or editable surface without sharing the surrounding Drive.", accent: "#ff6fc3" }
] as const;

const operatorFeatures = [
  { icon: HardDrive, title: "Own the data", copy: "Your Zo Computer remains the system of record." },
  { icon: Globe2, title: "Choose exposure", copy: "Private is the baseline. Public is an explicit action." },
  { icon: ShieldCheck, title: "Reduce surface area", copy: "Scoped links and credentials replace broad account access." },
  { icon: Sparkles, title: "Use local context", copy: "ZominAI reads current Drive state without gaining write authority." }
] as const;

const ownershipBenefits = [
  { number: "01", icon: HardDrive, title: "Storage you control", copy: "Your Drive data lives on your Zo machine, not inside a conventional centralised file silo." },
  { number: "02", icon: Server, title: "One machine, every workflow", copy: "Use the browser, command line or SDK against the same private storage and identity." },
  { number: "03", icon: ShieldCheck, title: "Private by default", copy: "Your workspace stays private until you deliberately create access for someone else." },
  { number: "04", icon: Send, title: "Share on your terms", copy: "Use scoped links, passcodes, expiry and revocation instead of broad account access." }
] as const;

const pricingComparisons = [
  { saas: "Pastebin Pro", price: "Price unavailable", zo: "Zo Paste" },
  { saas: "WeTransfer Ultimate", price: "US$25 / month", zo: "Zo Transfer" },
  { saas: "Vercel Pro", price: "US$20 / month", zo: "Zo Functions" },
  { saas: "Supabase Pro", price: "US$25 / month", zo: "Zo Databases" },
  { saas: "Google Workspace", price: "US$14/user / month", zo: "Zo Shared Drives" },
  { saas: "ChatGPT Plus", price: "US$20 / month", zo: "ZominAI" }
] as const;

function ProductTile({ index, compact = false }: { index: number; compact?: boolean }) {
  const product = products[index] ?? products[0];
  const Icon = product.icon;
  return <span className={`lp3-product-tile ${compact ? "lp3-product-tile-compact" : ""}`} style={{ background: product.gradient }}>
    <span className="lp3-product-glare" />
    <Icon aria-hidden="true" className="lp3-product-icon" size={compact ? 16 : 22} />
    <strong>{product.symbol}</strong>
  </span>;
}

export function useParticleField<T extends HTMLElement = HTMLElement>() {
  const heroRef = useRef<T>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = heroRef.current;
    if (!canvas || !hero || typeof CanvasRenderingContext2D === "undefined") return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spacing = 6;
    const repulsionRadiusSquared = 3136;
    const damping = 0.92;
    const spring = 0.16;
    const padding = 30;
    const trailLifetime = 430;
    const color = { red: 37, green: 99, blue: 235 };
    const baseAlpha = 118;

    let width = 0;
    let height = 0;
    let dots: Dot[] = [];
    let trail: TrailPoint[] = [];
    let imageData: ImageData | null = null;
    let pixels: Uint8ClampedArray | null = null;
    let pointerX = -1e9;
    let pointerY = -1e9;
    let lastPointerMove = -1e9;
    let lastTrailX = -1e9;
    let lastTrailY = -1e9;
    let lastTrailTime = 0;
    let animationFrame = 0;
    let animationRunning = false;
    let updateFrame = true;
    let resizeFrame = 0;

    const smoothstep = (value: number) => value * value * (3 - 2 * value);
    const proximity = (x: number, y: number, pointX: number, pointY: number, radius: number) => {
      const deltaX = x - pointX;
      const deltaY = y - pointY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      if (distanceSquared >= radius * radius) return 0;
      return smoothstep(1 - Math.sqrt(distanceSquared) / radius);
    };

    const paint = () => {
      if (!imageData || !pixels) return;
      pixels.fill(0);
      for (const dot of dots) {
        const x = dot.x | 0;
        const y = dot.y | 0;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const offset = (x + y * width) * 4;
        pixels[offset] = color.red;
        pixels[offset + 1] = color.green;
        pixels[offset + 2] = color.blue;
        pixels[offset + 3] = Math.min(205, Math.round(baseAlpha + dot.energy * 87));
      }
      context.putImageData(imageData, 0, 0);
    };

    const resize = () => {
      width = canvas.width = Math.max(1, hero.clientWidth);
      height = canvas.height = Math.max(1, hero.clientHeight);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      imageData = context.createImageData(width, height);
      pixels = imageData.data;
      const columns = Math.floor((width - padding * 2) / spacing);
      const rows = Math.floor((height - padding * 2) / spacing);
      dots = new Array(Math.max(0, columns * rows));
      let index = 0;
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const x = padding + column * spacing;
          const y = padding + row * spacing;
          dots[index] = { x, y, originX: x, originY: y, velocityX: 0, velocityY: 0, energy: 0 };
          index += 1;
        }
      }
      trail = [];
      paint();
    };

    const animate = (now: number) => {
      const pointerIsFresh = now - lastPointerMove <= 1200;
      if (!pointerIsFresh) pointerX = pointerY = -1e9;
      trail = trail.filter((point) => now - point.createdAt < trailLifetime);
      updateFrame = !updateFrame;
      if (updateFrame) {
        let moving = false;
        for (const dot of dots) {
          const deltaX = pointerX - dot.x;
          const deltaY = pointerY - dot.y;
          const distanceSquared = deltaX * deltaX + deltaY * deltaY;
          if (distanceSquared < repulsionRadiusSquared && distanceSquared > 0) {
            const force = -repulsionRadiusSquared / distanceSquared;
            const angle = Math.atan2(deltaY, deltaX);
            dot.velocityX += force * Math.cos(angle);
            dot.velocityY += force * Math.sin(angle);
          }
          let targetEnergy = pointerIsFresh ? proximity(dot.originX, dot.originY, pointerX, pointerY, 62) * 0.48 : 0;
          for (const point of trail) {
            const progress = (now - point.createdAt) / trailLifetime;
            const strength = (1 - progress) ** 2 * 0.42;
            if (strength <= targetEnergy) continue;
            const echo = proximity(dot.originX, dot.originY, point.x, point.y, 48) * strength;
            targetEnergy = Math.max(targetEnergy, echo);
          }
          dot.energy += (targetEnergy - dot.energy) * (targetEnergy > dot.energy ? 0.3 : 0.12);
          dot.x += (dot.velocityX *= damping) + (dot.originX - dot.x) * spring;
          dot.y += (dot.velocityY *= damping) + (dot.originY - dot.y) * spring;
          if (!moving && (
            dot.velocityX ** 2 + dot.velocityY ** 2 > 0.01 ||
            Math.abs(dot.x - dot.originX) > 0.4 ||
            Math.abs(dot.y - dot.originY) > 0.4 ||
            Math.abs(targetEnergy - dot.energy) > 0.008
          )) moving = true;
        }
        if (!moving && trail.length === 0) {
          paint();
          animationRunning = false;
          return;
        }
      } else {
        paint();
      }
      animationFrame = window.requestAnimationFrame(animate);
    };

    const startAnimation = () => {
      if (reducedMotion || animationRunning) return;
      animationRunning = true;
      animationFrame = window.requestAnimationFrame(animate);
    };

    const trackPointer = (event: globalThis.PointerEvent) => {
      const bounds = hero.getBoundingClientRect();
      const now = performance.now();
      const nextX = event.clientX - bounds.left;
      const nextY = event.clientY - bounds.top;
      const distanceFromLastTrail = Math.hypot(nextX - lastTrailX, nextY - lastTrailY);
      pointerX = nextX;
      pointerY = nextY;
      lastPointerMove = now;
      if (distanceFromLastTrail > 14 || now - lastTrailTime > 48) {
        trail.push({ x: nextX, y: nextY, createdAt: now });
        if (trail.length > 8) trail.shift();
        lastTrailX = nextX;
        lastTrailY = nextY;
        lastTrailTime = now;
      }
      startAnimation();
    };

    const clearPointer = () => {
      pointerX = pointerY = -1e9;
      lastPointerMove = -1e9;
      lastTrailX = -1e9;
      lastTrailY = -1e9;
      startAnimation();
    };
    const queueResize = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(resize);
    };
    const handleVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(animationFrame);
        animationRunning = false;
      } else {
        startAnimation();
      }
    };
    const handlePageHide = () => window.cancelAnimationFrame(animationFrame);

    resize();
    if (reducedMotion) return;
    window.addEventListener("resize", queueResize, { passive: true });
    hero.addEventListener("pointermove", trackPointer, { passive: true });
    hero.addEventListener("pointerleave", clearPointer);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide, { once: true });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(resizeFrame);
      window.removeEventListener("resize", queueResize);
      hero.removeEventListener("pointermove", trackPointer);
      hero.removeEventListener("pointerleave", clearPointer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  return { heroRef, canvasRef };
}

export function LandingPageThree({ currentLandingUrl, docsUrl, driveUrl, loginUrl, logoCloudUrl, logoPegasusUrl }: LandingPageThreeProps) {
  const [activeProduct, setActiveProduct] = useState(0);
  const selected = products[activeProduct] ?? products[0];
  const { heroRef, canvasRef } = useParticleField();
  const productUrl = (section: string) => driveUrl + "&section=" + section;
  const cliDocsUrl = docsUrl.includes("mode=gui") ? docsUrl.replace("mode=gui", "mode=cli") : `${docsUrl}${docsUrl.includes("?") ? "&" : "?"}mode=cli`;

  return <main className="zr-page">
    <section className="hero" id="top" ref={heroRef}>
      <div aria-hidden="true" className="hero-wash wash-one" />
      <div aria-hidden="true" className="hero-wash wash-two" />
      <canvas aria-hidden="true" className="particle-field" ref={canvasRef} />
      <header>
        <a aria-label="Zo Drive home" className="brand" href="#top"><span className="brand-mark">z</span><span>Zo Drive</span></a>
        <nav aria-label="Zo Drive section navigation"><a href="#why-zo">Why Zo</a><a href="#products">Products</a><a href="#teams">Teams</a><a href="#operators">Operators</a></nav>
        <div className="header-actions">
          <a aria-label="Open Zo Drive documentation" className="nav-docs" href={docsUrl}>Docs</a>
          <a className="nav-cta" href={driveUrl}>Open Zo Drive <span>↗</span></a>
        </div>
      </header>

      <div className="hero-copy">
        <p className="eyebrow"><span />Decentralised cloud, on your Zo</p>
        <h1>Your cloud,<br /><em>under your control.</em></h1>
        <p className="hero-lede">A private workspace for the files you own, running on your Zo machine and connected to the way your team actually works.</p>
        <div className="hero-actions"><a className="button primary" href={loginUrl}>Sign in to Zo Drive <span>→</span></a><a className="button ghost" href="#products">Explore the platform <span>↓</span></a></div>
        <div className="hero-proof"><span><b>Private</b> by default</span><span><b>One Drive</b> · available in GUI and CLI</span><span><b>Share</b> on your terms</span></div>
      </div>

      <div aria-label="Zo Drive product preview" className="product-orbit">
        <div className="floating-chip chip-one"><span className="chip-icon violet">✦</span><span><b>Zo Functions</b><small>weekly-report.js · active</small></span><i>✓</i></div>
        <div className="floating-chip chip-two"><span className="chip-icon cyan">⌁</span><span><b>ZominAI</b><small>Private local context</small></span><i>✓</i></div>
        <div className="drive-window">
          <div className="window-top"><div className="traffic"><i /><i /><i /></div><div className="window-title"><span className="window-logo">z</span>My Drive</div><button aria-label="Search files" type="button">⌕</button></div>
          <div className="drive-body">
            <aside><span className="nav-label">Workspace</span><span className="side-link active"><i>⌂</i>Home</span><span className="side-link"><i>▰</i>My Drive</span><span className="side-link"><i>↗</i>Shared with me</span><span className="side-link"><i>★</i>Starred</span><span className="nav-label second">Create</span><span className="side-link"><i>+</i>New file</span><span className="side-link"><i>↑</i>Upload</span><div className="storage"><span><b>2.4 GB</b> of 10 GB</span><i><b /></i><small>Storage on your Zo</small></div></aside>
            <section className="file-area"><div className="file-head"><div><p>Good morning, Sayyid</p><h2>Your work, in one place.</h2></div><button className="new-button" type="button">+ New</button></div><div className="suggestions"><article className="suggestion main"><span>Continue working</span><b>product-brief.md</b><small>Edited 12 minutes ago</small><i>↗</i></article><article className="suggestion ai"><span>Ask ZominAI</span><b>Find what matters.</b><small>Private context, local-first</small><i>✦</i></article></div><div className="files-title"><span>Recent files</span><button type="button">View all</button></div><div className="file-list"><div><span className="file-icon blue">▤</span><p><b>Q3 product roadmap</b><small>Product / Strategy</small></p><time>Today</time><button aria-label="Q3 product roadmap actions" type="button">•••</button></div><div><span className="file-icon gold">△</span><p><b>Partner launch assets</b><small>Design / Brand</small></p><time>Yesterday</time><button aria-label="Partner launch assets actions" type="button">•••</button></div><div><span className="file-icon green">▦</span><p><b>Revenue model v4</b><small>Finance / Planning</small></p><time>Jul 19</time><button aria-label="Revenue model actions" type="button">•••</button></div></div></section>
            <aside className="insight"><div className="insight-head"><span>Activity</span><button aria-label="Activity actions" type="button">•••</button></div><div className="activity"><span className="avatar rose">D</span><p><b>Dina shared</b><small>Partner launch assets</small></p><time>2m</time></div><div className="activity"><span className="avatar blue-avatar">S</span><p><b>You updated</b><small>Q3 product roadmap</small></p><time>12m</time></div><div className="activity"><span className="avatar gold-avatar">A</span><p><b>Alex commented</b><small>Revenue model v4</small></p><time>1h</time></div><div className="trust-card"><span>Private by default</span><b>Nothing leaves your Zo without your say.</b><a href="#teams">Review access →</a></div></aside>
          </div>
        </div>
        <div className="orbital-line one" /><div className="orbital-line two" />
      </div>
      <div className="hero-footer"><span>01 / OWN THE DATA</span><span>02 / RUN THE WORK</span><span>03 / SHARE ON YOUR TERMS</span></div>
    </section>

    <div className="lp3-page">
      <section className="bg-[#f6f2ea] px-5 py-24 sm:px-8 lg:py-32" id="why-zo">
        <div className="mx-auto max-w-[92rem]">
          <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
            <p className="lp3-mono text-[.7rem] font-semibold uppercase tracking-[.16em] text-[#d34a21]">Why Zo</p>
            <h2 className="lp3-section-title max-w-5xl">A cloud should increase your agency, not your dependency.</h2>
          </div>
          <div className="mt-14 grid border-l border-t border-black/15 sm:grid-cols-2 lg:grid-cols-4">
            {ownershipBenefits.map(({ number, icon: Icon, title, copy }) => <article className="flex min-h-[19rem] flex-col border-b border-r border-black/15 bg-white/45 p-7 sm:p-9" key={number}>
              <div className="flex items-start justify-between gap-4"><span className="font-serif text-4xl italic text-[#d34a21]">{number}</span><span className="grid size-11 place-items-center rounded-full bg-[#dce8ff] text-[#174da6]"><Icon size={20} /></span></div>
              <h3 className="mt-auto pt-16 text-xl font-extrabold tracking-[-.035em]">{title}</h3>
              <p className="mt-4 text-sm leading-6 text-black/58">{copy}</p>
            </article>)}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 lg:py-32" id="interfaces">
        <div className="mx-auto max-w-[92rem]">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-end">
            <div><p className="lp3-mono text-[.7rem] font-semibold uppercase tracking-[.16em] text-[#2563eb]">GUI + CLI</p><h2 className="lp3-section-title mt-6">One Drive.<br />Two ways to work.</h2></div>
            <p className="max-w-xl text-base leading-7 text-black/62">Manage the same private files and products visually or automate them precisely from the command line. No export, migration or second account between the two.</p>
          </div>
          <div className="mt-14 grid overflow-hidden border border-black/15 lg:grid-cols-2">
            <article aria-label="Zo Drive GUI workflow" className="bg-[#edf4ff] p-7 sm:p-10">
              <div className="flex items-center justify-between"><span className="grid size-12 place-items-center bg-white text-[#1d55c6]"><MonitorUp size={22} /></span><span className="lp3-mono text-[.62rem] uppercase tracking-[.14em] text-black/42">01 / GUI</span></div>
              <h3 className="mt-14 text-3xl font-extrabold tracking-[-.05em]">Work in context.</h3>
              <p className="mt-4 max-w-lg text-sm leading-6 text-black/58">Browse, upload, share and manage all six products visually, including browser-only ZominAI.</p>
              <div className="mt-8 overflow-hidden border border-black/10 bg-white">
                <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 text-xs font-bold"><span>Product / Launch</span><span className="text-[#2563eb]">4 files</span></div>
                <div className="grid grid-cols-3 gap-px bg-black/10 text-center text-xs font-bold text-black/60"><span className="bg-white px-3 py-4">Upload</span><span className="bg-white px-3 py-4">Organise</span><span className="bg-white px-3 py-4">Share</span></div>
              </div>
              <a className="lp3-link-blue lp3-arrow-link mt-7 inline-flex items-center gap-2 text-xs font-extrabold" href={docsUrl}>Explore GUI <ArrowRight size={14} /></a>
            </article>
            <article aria-label="Zo Drive CLI workflow" className="border-t border-black/15 bg-[#111827] p-7 text-white lg:border-l lg:border-t-0 sm:p-10">
              <div className="flex items-center justify-between"><span className="grid size-12 place-items-center bg-white/10 text-[#67e8f9]"><Terminal size={22} /></span><span className="lp3-mono text-[.62rem] uppercase tracking-[.14em] text-white/42">02 / CLI</span></div>
              <h3 className="mt-14 text-3xl font-extrabold tracking-[-.05em]">Run repeatable work.</h3>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/58">Script Drive, Paste, Transfer, Shared Drives, Databases and Functions. ZominAI stays in the GUI by design.</p>
              <div className="lp3-mono mt-8 border border-white/15 bg-black/35 p-5 text-xs leading-6 text-white/75"><p><span className="text-white/35">$ </span><span className="text-[#67e8f9]">zo-drive</span> upload ./launch-plan.pdf <span className="text-[#facc15]">--path</span> Product/Launch</p><p className="mt-3 text-[#86efac]">✓ Uploaded Product/Launch/launch-plan.pdf</p><p className="text-white/38">✓ Ready for the next job</p></div>
              <a className="lp3-link-cyan lp3-arrow-link mt-7 inline-flex items-center gap-2 text-xs font-extrabold" href={cliDocsUrl}>Explore CLI <ArrowRight size={14} /></a>
            </article>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 lg:py-36" id="products">
        <div className="mx-auto max-w-[92rem]">
          <p className="lp3-mono text-[.7rem] font-semibold uppercase tracking-[.16em] text-[#5c2dff]">The Zo Drive product family</p>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-end"><h2 className="lp3-section-title">One home.<br />Six focused tools.</h2><p className="max-w-xl text-base leading-7 text-black/62">Every product has a clear job. Together they form one owner-controlled system around the same identity, files and private context, without handing your data to a new SaaS vendor at every step.</p></div>
          <div className="mt-16 grid gap-4 lg:grid-cols-[.62fr_1.38fr]">
            <div aria-label="Choose a Zo Drive product" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2" role="tablist">
              {products.map((product, index) => <button aria-selected={activeProduct === index} className={`lp3-product-tab flex items-center gap-3 border border-black/15 p-3 text-left ${activeProduct === index ? "bg-black text-white" : "bg-white"}`} key={product.name} onClick={() => setActiveProduct(index)} role="tab" type="button"><ProductTile compact index={index} /><span className="text-xs font-extrabold">{product.name}</span></button>)}
            </div>
            <div className="lp3-product-stage grid min-h-[34rem] overflow-hidden bg-black text-white lg:grid-cols-[.78fr_1.22fr]" role="tabpanel">
              <div className="flex flex-col p-7 sm:p-10">
                <ProductTile index={activeProduct} />
                <p className="lp3-mono mt-8 text-[.62rem] uppercase tracking-[.13em] text-white/45">{selected.category}</p>
                <h3 className="mt-3 text-4xl font-extrabold tracking-[-.055em]">{selected.name}</h3>
                <p className="mt-5 max-w-sm text-sm leading-6 text-white/58">{selected.description}</p>
                <a aria-label={`Open ${selected.name}`} className="lp3-arrow-link mt-auto flex items-center gap-2 pt-9 text-xs font-extrabold" href={productUrl(selected.section)}>Open {selected.name} <ArrowRight size={14} /></a>
              </div>
              <div className="relative flex min-h-[24rem] flex-col overflow-hidden border-t border-white/15 bg-white/5 p-7 lg:border-l lg:border-t-0 sm:p-10">
                <span className="lp3-mono text-[.58rem] uppercase tracking-[.14em] text-[#d9ff3f]">Active product</span>
                <strong className="mt-3 block text-3xl tracking-[-.05em]">{selected.name}</strong>
                <div className="mt-12 grid gap-3">{selected.highlights.map(([title, copy]) => <div className="border border-white/15 p-5" key={title}><strong className="text-sm">{title}</strong><p className="mt-2 text-xs leading-5 text-white/48">{copy}</p></div>)}</div>
                <p className="lp3-mono mt-auto pt-8 text-[.55rem] uppercase tracking-[.14em] text-white/35">{selected.outcome}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0d1117] px-5 py-24 text-white sm:px-8 lg:py-32" id="pricing">
        <div className="mx-auto max-w-[92rem]">
          <div className="max-w-4xl"><p className="lp3-mono text-[.7rem] font-semibold uppercase tracking-[.16em] text-[#67e8f9]">Product economics</p><h2 className="lp3-section-title mt-6">Six subscriptions become one private suite.</h2><p className="mt-7 max-w-2xl text-base leading-7 text-white/58">Keep the workflows. Remove repeated accounts, scattered data and avoidable monthly SaaS spend after seeing the products that replace them.</p></div>
          <div className="mt-14 grid gap-4 lg:grid-cols-2">
            <article aria-label="Fragmented SaaS pricing" className="border border-white/15 bg-white/[.04] p-6 sm:p-9">
              <p className="lp3-mono text-[.62rem] uppercase tracking-[.14em] text-[#fb923c]">Before / fragmented SaaS</p><h3 className="mt-3 text-2xl font-extrabold tracking-[-.04em]">Six vendors</h3>
              <div className="mt-7 divide-y divide-white/10">{pricingComparisons.map(({ saas, price }) => <div className="flex items-center justify-between gap-4 py-3.5" key={saas}><strong className="text-sm">{saas}</strong><span className="text-right text-xs text-white/48">{price}</span></div>)}</div>
              <div className="mt-7 border border-white/10 bg-black/35 p-5"><p className="lp3-mono text-[.58rem] uppercase tracking-[.13em] text-white/42">Published starting prices</p><p className="mt-3 text-4xl font-extrabold tracking-[-.05em]">US$104+ <span className="text-base font-medium text-white/42">/ month</span></p><p className="mt-3 text-xs leading-5 text-white/42">Before Pastebin Pro, taxes and additional usage charges.</p></div>
            </article>
            <article aria-label="Zo product pricing" className="border border-[#67e8f9]/35 bg-[#67e8f9]/[.07] p-6 sm:p-9">
              <p className="lp3-mono text-[.62rem] uppercase tracking-[.14em] text-[#a5f3fc]">After / Zo Drive</p><h3 className="mt-3 text-2xl font-extrabold tracking-[-.04em]">One private system</h3>
              <div className="mt-7 divide-y divide-[#a5f3fc]/15">{pricingComparisons.map(({ zo }) => <div className="flex items-center justify-between gap-4 py-3.5" key={zo}><strong className="text-sm text-[#ecfeff]">{zo}</strong><span className="text-xs font-bold text-[#a5f3fc]">US$0 extra</span></div>)}</div>
              <div className="mt-7 border border-[#a5f3fc]/20 bg-[#083344]/70 p-5"><p className="lp3-mono text-[.58rem] uppercase tracking-[.13em] text-[#a5f3fc]/65">Additional SaaS cost</p><p className="mt-3 text-4xl font-extrabold tracking-[-.05em] text-[#ecfeff]">US$0 <span className="text-base font-medium text-[#a5f3fc]/65">extra / feature</span></p><p className="mt-3 text-xs leading-5 text-[#a5f3fc]/65">All six features are included with Zo Drive on your Zo Computer.</p></div>
            </article>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-y border-black bg-[#d9ff3f] py-5">
        <div className="lp3-ticker lp3-mono text-[.62rem] font-semibold uppercase tracking-[.12em]">{[0, 1].map((copy) => <div className="flex" key={copy}>{["SQLite", "DuckDB", "libSQL", "PGlite", "LanceDB", "LevelDB", "Redis", "Kuzu", "JavaScript", "Python", "Local AI"].map((item) => <span key={`${copy}-${item}`}>{item} +</span>)}</div>)}</div>
      </section>

      <section className="bg-[#111] px-5 py-24 text-white sm:px-8 lg:py-36" id="teams">
        <div className="mx-auto max-w-[92rem]">
          <p className="lp3-mono text-[.7rem] font-semibold uppercase tracking-[.16em] text-[#5fe7ff]">For teams</p>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-end"><h2 className="lp3-section-title">Share the work.<br />Keep the source.</h2><p className="max-w-xl text-base leading-7 text-white/62">Zo Shared Drives, Transfer and Paste turn collaboration into specific grants instead of an all-or-nothing migration.</p></div>
          <div className="mt-16 grid gap-4 lg:grid-cols-3">{teamFeatures.map(({ icon: Icon, title, copy, accent }) => <article className="border border-white/20 p-7 sm:p-9" key={title}><span className="grid size-12 place-items-center text-[#111]" style={{ background: accent }}><Icon size={22} /></span><h3 className="mt-16 text-2xl font-extrabold tracking-[-.04em]">{title}</h3><p className="mt-4 text-sm leading-6 text-white/55">{copy}</p></article>)}</div>
          <div className="mt-5 border border-white/20 bg-white/5 p-7 sm:p-10"><div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-center"><div><p className="lp3-mono text-[.62rem] uppercase tracking-[.15em] text-[#d9ff3f]">A different collaboration model</p><h3 className="mt-4 text-3xl font-extrabold tracking-[-.045em] sm:text-5xl">Access travels.<br />Ownership does not.</h3></div><div className="grid gap-3 sm:grid-cols-3">{[[UsersRound, "Invite"], [ShieldCheck, "Scope"], [Server, "Serve"]].map(([Icon, label], index) => { const FlowIcon = Icon as typeof UsersRound; return <div className="flex items-center gap-3 border border-white/15 p-4" key={String(label)}><span className="lp3-mono text-[.58rem] text-white/40">0{index + 1}</span><FlowIcon size={17} /><strong className="text-xs">{String(label)}</strong></div>; })}</div></div></div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 lg:py-36" id="operators">
        <div className="mx-auto max-w-[92rem]">
          <p className="lp3-mono text-[.7rem] font-semibold uppercase tracking-[.16em] text-[#007a46]">For operators</p>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-end"><h2 className="lp3-section-title">One system to operate.</h2><p className="max-w-xl text-base leading-7 text-black/62">Bring storage, data, functions and AI into the same operational boundary. Fewer vendors, clearer permissions and direct control over cost.</p></div>
          <div className="mt-16 grid border-l border-t border-black lg:grid-cols-4">{operatorFeatures.map(({ icon: Icon, title, copy }) => <article className="border-b border-r border-black p-7 sm:p-9" key={title}><Icon size={24} /><h3 className="mt-20 text-xl font-extrabold tracking-[-.035em]">{title}</h3><p className="mt-3 text-sm leading-6 text-black/55">{copy}</p></article>)}</div>
        </div>
      </section>

      <section className="px-5 pb-5 sm:px-8">
        <div className="mx-auto grid max-w-[92rem] overflow-hidden bg-[#ff563f] lg:grid-cols-[1.15fr_.85fr]">
          <div className="p-8 sm:p-12 lg:p-16"><p className="lp3-mono text-[.68rem] font-semibold uppercase tracking-[.15em]">Your private platform starts here</p><h2 className="mt-6 text-5xl font-extrabold leading-[.92] tracking-[-.065em] sm:text-7xl">Put your cloud<br />back in reach.</h2><div className="mt-9 flex flex-wrap gap-3"><a aria-label="Open Zo Drive from final call to action" className="lp3-primary-cta lp3-arrow-link flex items-center gap-3 bg-black px-6 py-4 text-xs font-extrabold" href={driveUrl}>Open Zo Drive <ArrowRight size={15} /></a><a className="lp3-arrow-link flex items-center gap-3 border border-black px-6 py-4 text-xs font-extrabold" href={docsUrl}>Read the docs <ArrowRight size={15} /></a></div></div>
          <div className="relative min-h-[26rem] overflow-hidden bg-black">{[0, 5, 2, 3].map((index, position) => <div className={["absolute left-[12%] top-[12%] scale-125 -rotate-6", "absolute right-[14%] top-[18%] scale-[1.7] rotate-[7deg]", "absolute bottom-[13%] left-[26%] scale-[1.45] rotate-[5deg]", "absolute bottom-[15%] right-[11%] scale-110 -rotate-6"][position]} key={index}><ProductTile index={index} /></div>)}</div>
        </div>
      </section>

      <footer aria-label="Zo Drive footer" className="lp3-minimal-footer px-5 py-7 sm:px-8">
        <div className="mx-auto flex max-w-[92rem] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <a className="flex w-fit items-center gap-2.5 text-sm font-extrabold" href={currentLandingUrl}><span className="relative block size-8"><img alt="" className="absolute inset-0 size-full" src={logoCloudUrl} /><img alt="" className="absolute left-[5.94%] top-0 h-[88.44%] w-[88.44%]" src={logoPegasusUrl} /></span>Zo Drive</a>
          <div aria-label="Footer navigation" className="lp3-footer-nav flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold"><a href="#products">Products</a><a href={docsUrl}>Documentation</a><a href={driveUrl}>Open Drive</a></div>
          <span className="lp3-footer-meta lp3-mono text-[.55rem] uppercase tracking-[.12em]">Built on Zo Computer</span>
        </div>
      </footer>
    </div>
  </main>;
}

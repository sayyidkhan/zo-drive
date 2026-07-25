import { ArrowRight, Bot, Database, FileText, Folder, HardDrive, Search, Send, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef } from "react";

import "./landing-remix.css";

type LandingRemixProps = {
  cloudLogoUrl: string;
  docsUrl: string;
  driveUrl: string;
  loginUrl: string;
  pegasusLogoUrl: string;
};

type Particle = { homeX: number; homeY: number; vx: number; vy: number; x: number; y: number };

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.closest<HTMLElement>(".remix-hero");
    const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canvas || !section || reducedMotion || navigator.userAgent.includes("jsdom")) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let particles: Particle[] = [];
    let pointer = { x: -10000, y: -10000 };
    let width = 0;
    let height = 0;
    const density = 31;

    const resize = () => {
      const rect = section.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.ceil(rect.width);
      height = Math.ceil(rect.height);
      canvas.width = Math.ceil(width * ratio);
      canvas.height = Math.ceil(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = [];
      for (let y = 20; y < height; y += density) {
        for (let x = 20; x < width; x += density) particles.push({ homeX: x, homeY: y, x, y, vx: 0, vy: 0 });
      }
    };

    const animate = () => {
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < 108) {
          const force = (108 - distance) / 108;
          particle.vx += (dx / distance) * force * 1.5;
          particle.vy += (dy / distance) * force * 1.5;
        }
        particle.vx = (particle.vx + (particle.homeX - particle.x) * 0.025) * 0.84;
        particle.vy = (particle.vy + (particle.homeY - particle.y) * 0.025) * 0.84;
        particle.x += particle.vx;
        particle.y += particle.vy;
        const active = distance < 150;
        context.fillStyle = active ? "rgba(255, 100, 61, .5)" : "rgba(11, 74, 65, .12)";
        context.fillRect(Math.round(particle.x), Math.round(particle.y), active ? 2 : 1, active ? 2 : 1);
      }
      animationFrame = window.requestAnimationFrame(animate);
    };

    const move = (event: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const leave = () => { pointer = { x: -10000, y: -10000 }; };
    const observer = new ResizeObserver(resize);
    observer.observe(section);
    section.addEventListener("pointermove", move, { passive: true });
    section.addEventListener("pointerleave", leave);
    resize();
    animationFrame = window.requestAnimationFrame(animate);
    return () => {
      observer.disconnect();
      section.removeEventListener("pointermove", move);
      section.removeEventListener("pointerleave", leave);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <canvas aria-hidden="true" className="remix-particles" ref={canvasRef} />;
}

const productTiles = [
  { icon: FileText, meta: "Document / 12 min ago", title: "Launch brief", tone: "sand" },
  { icon: Database, meta: "Database / Today", title: "Campaign data", tone: "mint" },
  { icon: Upload, meta: "Video / Yesterday", title: "Product film", tone: "coral" },
  { icon: Folder, meta: "Shared folder / Yesterday", title: "Partner notes", tone: "slate" }
];

export function LandingRemix({ cloudLogoUrl, docsUrl, driveUrl, loginUrl, pegasusLogoUrl }: LandingRemixProps) {
  return <main className="remix-page">
    <section className="remix-hero" id="top">
      <ParticleField />
      <header className="remix-nav">
        <a aria-label="Zo Drive home" className="remix-brand" href="#top"><span className="remix-logo"><img alt="" src={cloudLogoUrl} /><img alt="" src={pegasusLogoUrl} /></span><span>Zo Drive</span></a>
        <nav aria-label="Zo Drive concept navigation" className="remix-nav-links"><a href="#suite">Products</a><a href="#ownership">Why Zo Drive</a><a href="#savings">Savings</a><a href={docsUrl}>Docs</a></nav>
        <a className="remix-open" href={loginUrl}>Open Drive <ArrowRight size={17} /></a>
      </header>

      <div className="remix-hero-grid">
        <div className="remix-copy">
          <p className="remix-eyebrow"><span />Your decentralised cloud</p>
          <h1>Own the<br /><em>cloud.</em><br />Keep the<br /><strong>leverage.</strong></h1>
          <p className="remix-lede">One private system for files, secure delivery, automations, databases, collaboration and local AI.</p>
          <a className="remix-text-link" href="#suite">Meet the suite <ArrowRight size={16} /></a>
          <div className="remix-principles"><span><b>Private by default</b> Nothing is public until you decide.</span><span><b>Open by design</b> Browser, CLI and SDK access one Drive.</span><span><b>Yours to operate</b> The source of truth lives on your Zo.</span></div>
        </div>

        <div aria-label="Zo Drive workspace preview" className="remix-drive-preview">
          <div className="remix-orbit remix-orbit-one" /><div className="remix-orbit remix-orbit-two" />
          <div className="remix-window">
            <div className="remix-window-top"><span className="remix-dots"><i /><i /><i /></span><b>My Drive / Product</b><Search aria-label="Search files" size={19} /></div>
            <div className="remix-window-content">
              <aside className="remix-sidebar"><strong><HardDrive size={18} /> Zo Drive</strong><a className="active" href={driveUrl}><Folder size={18} /> My Drive</a><span><Sparkles size={18} /> ZominAI</span><span><Send size={18} /> Transfer</span><span><Database size={18} /> Databases</span></aside>
              <div className="remix-workspace"><p className="remix-workspace-label">Workspace</p><div className="remix-workspace-title"><h2>Product launch</h2><span><Upload size={23} /></span></div><div className="remix-tile-grid">{productTiles.map(({ icon: Icon, meta, title, tone }) => <article className="remix-tile" key={title}><span className={`remix-tile-icon ${tone}`}><Icon size={22} /></span><h3>{title}</h3><p>{meta}</p></article>)}</div><a className="remix-ai-ready" href={`${driveUrl}&section=zominai`}><Bot size={20} />ZominAI is ready <ArrowRight size={19} /></a></div>
            </div>
          </div>
          <div className="remix-float-card"><p>Six products</p><em>One private cloud.</em></div>
        </div>
      </div>
    </section>

    <section className="remix-ownership" id="ownership"><div><p className="remix-eyebrow"><span />The ownership advantage</p><h2>A cloud should increase your <em>agency,</em> not your dependency.</h2></div><div className="remix-ownership-grid"><article><span>01</span><h3>Keep the source</h3><p>Your files and product data remain on the Zo Computer you control.</p></article><article><span>02</span><h3>Open with intent</h3><p>Share one paste, one transfer or one folder without opening the entire estate.</p></article><article><span>03</span><h3>Compound the stack</h3><p>Every new workflow starts beside your existing files, functions and databases.</p></article></div></section>

    <section className="remix-suite" id="suite"><p className="remix-eyebrow"><span />The Zo Drive suite</p><h2>Six focused products.<br /><em>One calm system.</em></h2><p className="remix-suite-lede">Move from publishing to delivery, automation, data, collaboration and AI without moving your work between vendors.</p><div className="remix-suite-grid"><div className="remix-product-list">{[["01", "Zo Paste", "Publish"], ["02", "Zo Transfer", "Deliver"], ["03", "Zo Functions", "Automate"], ["04", "Zo Databases", "Build"], ["05", "Zo Shared Drives", "Collaborate"], ["06", "ZominAI", "Understand"]].map(([number, title, label], index) => <a className={index === 1 ? "selected" : ""} href={index === 1 ? `${driveUrl}&section=transfer` : driveUrl} key={title}><span>{number}</span><b>{title}</b><small>{label}</small><ArrowRight size={16} /></a>)}</div><article className="remix-transfer-card"><p>Deliver · Zo Transfer</p><h3>Send the file.<br /><em>Keep the folder closed.</em></h3><p>Create purpose-built delivery links for existing Drive files or new uploads, with deliberate access and expiry controls.</p><div><span>launch-film.mp4</span><span>2.4 GB</span><span>Passcode access</span></div><a href={`${driveUrl}&section=transfer`}>Open Zo Transfer <ArrowRight size={16} /></a></article></div></section>

    <section className="remix-savings" id="savings"><div><p className="remix-eyebrow"><span />The economics</p><h2>Six subscriptions become <em>one private suite.</em></h2><p>Keep the workflows. Remove the repeated accounts, scattered data and avoidable monthly SaaS spend.</p></div><div className="remix-comparison"><article><p>Before / fragmented SaaS</p><h3>Six vendors</h3><ul><li>Pastebin Pro</li><li>WeTransfer Ultimate</li><li>Vercel Pro</li><li>Supabase Pro</li><li>Google Workspace</li><li>ChatGPT Plus</li></ul><b>US$104+ <small>/ month</small></b></article><article className="remix-after"><p>After / Zo Drive</p><h3>One private system</h3><ul><li>Zo Paste</li><li>Zo Transfer</li><li>Zo Functions</li><li>Zo Databases</li><li>Zo Shared Drives</li><li>ZominAI</li></ul><b>US$0 <small>extra / feature</small></b></article></div></section>

    <section className="remix-closing"><p className="remix-eyebrow"><span />Bring your cloud home</p><h2>The workspace you own.<br /><em>The work you can move.</em></h2><p>Build, share, automate and understand your data from the machine you control.</p><div><a className="remix-open" href={loginUrl}>Enter Zo Drive <ArrowRight size={17} /></a><a className="remix-text-link" href={docsUrl}>Read the guide <ArrowRight size={16} /></a></div></section>
    <footer className="remix-footer"><a className="remix-brand" href="#top"><span className="remix-logo"><img alt="" src={cloudLogoUrl} /><img alt="" src={pegasusLogoUrl} /></span><span>Zo Drive</span></a><span>Decentralised cloud, on your Zo</span><a href={driveUrl}>Return to Drive</a></footer>
  </main>;
}

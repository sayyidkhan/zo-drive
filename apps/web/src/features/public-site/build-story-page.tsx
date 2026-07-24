import { ArrowUpRight, Code2, Database, HardDrive, Laptop, Network, Server, ShieldCheck, Terminal } from "lucide-react";
import "./build-story-page.css";

type BuildStoryPageProps = {
  docsUrl: string;
  driveUrl: string;
  homeUrl: string;
  logoCloudUrl: string;
  logoPegasusUrl: string;
};

const frontendStack = [
  ["React 19", "Interactive browser workspace"],
  ["TypeScript", "One typed language across the monorepo"],
  ["Vite + Tailwind", "Fast builds and responsive UI"],
  ["TanStack Query + Zustand", "Server cache and focused UI state"]
] as const;

const serviceStack = [
  ["Hono + Zod", "REST API and request validation"],
  ["Node.js", "Zo Computer service runtime"],
  ["Local filesystem", "Private Drive files and product metadata"],
  ["SQLite, DuckDB, libSQL + more", "Optional local database runtimes"]
] as const;

const deliveryStack = [
  ["CLI + SDK", "Automation from a developer's local machine"],
  ["Scoped API keys", "Revocable device access over HTTPS"],
  ["Cluster pairing", "One-time invitations for live folder mounts"],
  ["Local cache", "Read resilience when a peer is temporarily unavailable"]
] as const;

function StackCard({ icon: Icon, items, title }: { icon: typeof Code2; items: readonly (readonly [string, string])[]; title: string }) {
  return <article className="build-stack-card">
    <div className="build-card-heading"><span><Icon size={19} /></span><h3>{title}</h3></div>
    <ul>{items.map(([name, purpose]) => <li key={name}><strong>{name}</strong><span>{purpose}</span></li>)}</ul>
  </article>;
}

function BuildBrand({ homeUrl, logoCloudUrl, logoPegasusUrl }: Pick<BuildStoryPageProps, "homeUrl" | "logoCloudUrl" | "logoPegasusUrl">) {
  return <a className="build-brand" href={homeUrl}>
    <span aria-label="Zo Drive Pegasus on a cloud" className="build-brand-logo" role="img">
      <img alt="" className="build-brand-cloud" src={logoCloudUrl} />
      <img alt="" className="build-brand-pegasus" src={logoPegasusUrl} />
    </span>
    Zo Drive
  </a>;
}

export function BuildStoryPage({ docsUrl, driveUrl, homeUrl, logoCloudUrl, logoPegasusUrl }: BuildStoryPageProps) {
  return <main className="build-page">
    <header className="build-header">
      <BuildBrand homeUrl={homeUrl} logoCloudUrl={logoCloudUrl} logoPegasusUrl={logoPegasusUrl} />
      <nav aria-label="How Zo Drive is built"><a href="#stack">Stack</a><a href="#architecture">Architecture</a><a href="#clusters">Clusters</a></nav>
      <div className="build-header-actions"><a href={docsUrl}>Docs</a><a className="build-open-drive" href={driveUrl}>Open Drive <ArrowUpRight size={15} /></a></div>
    </header>

    <section className="build-hero">
      <p className="build-kicker">Behind Zo Drive</p>
      <h1>A private cloud drive,<br /><em>built around your Zo Computer.</em></h1>
      <p>Zo Drive is one TypeScript monorepo that puts the browser, CLI, local storage, data runtimes and collaboration model behind a single API. The Zo Computer is the system of record; other machines connect to it deliberately.</p>
      <div className="build-hero-actions"><a className="build-primary-link" href="#architecture">See the architecture <ArrowUpRight size={16} /></a><a className="build-text-link" href={driveUrl}>Try the working product</a></div>
    </section>

    <section className="build-section" id="stack">
      <div className="build-section-intro"><p className="build-kicker">The stack</p><h2>One codebase. Clear boundaries.</h2><p>The web app, API, CLI and shared contracts live together, so each surface talks to the same Drive rather than maintaining a separate copy of the product.</p></div>
      <div className="build-stack-grid">
        <StackCard icon={Code2} items={frontendStack} title="Browser application" />
        <StackCard icon={Server} items={serviceStack} title="Zo Computer services" />
        <StackCard icon={Terminal} items={deliveryStack} title="Connected clients" />
      </div>
    </section>

    <section className="build-section build-architecture-section" id="architecture">
      <div className="build-section-intro"><p className="build-kicker">Architecture</p><h2>Clients call one Drive API. Zo keeps the data.</h2><p>Whether work starts in a browser on Zo or a terminal on another machine, the request arrives at the Zo Drive API. Files and private product state stay on the Zo Computer that owns them.</p></div>
      <div aria-label="Zo Drive architecture: local clients connect by HTTPS to a Zo Computer that runs the web application, API, local Drive storage, metadata, and database runtimes" className="build-architecture-diagram">
        <div className="build-diagram-clients">
          <div className="build-diagram-label">Clients</div>
          <article><Laptop size={20} /><strong>Browser</strong><span>Zo Drive GUI</span></article>
          <article><Terminal size={20} /><strong>Local machine</strong><span>CLI and SDK</span></article>
        </div>
        <div className="build-flow"><span>Authenticated HTTPS</span><i aria-hidden="true">→</i></div>
        <div className="build-zo-computer">
          <div className="build-diagram-label">Your Zo Computer · authoritative</div>
          <div className="build-service-top"><article><Code2 size={19} /><strong>Web app</strong><span>React UI served to the browser</span></article><article><Server size={19} /><strong>Drive API</strong><span>Hono REST endpoints + validation</span></article></div>
          <div className="build-service-bottom"><article><HardDrive size={19} /><strong>Private Drive storage</strong><span>Files, folders, shares and product state</span></article><article><Database size={19} /><strong>Local data runtimes</strong><span>SQLite, DuckDB, libSQL and more</span></article></div>
        </div>
      </div>
      <div className="build-principles"><p><ShieldCheck size={17} /><span><strong>Scoped access</strong> Browser sessions and device keys are checked by the API.</span></p><p><HardDrive size={17} /><span><strong>No second storage plane</strong> The Drive owner’s Zo Computer holds the source files.</span></p><p><Network size={17} /><span><strong>One contract</strong> GUI, CLI and SDK use the same REST surface.</span></p></div>
    </section>

    <section className="build-section build-cluster-section" id="clusters">
      <div className="build-section-intro"><p className="build-kicker">Zo Shared Drives</p><h2>Clusters share access, not ownership.</h2><p>A shared folder is mounted from another Zo Drive. The source Zo Computer continues to own and serve the files; the receiving Zo keeps only the mount record and a private cache for temporary read resilience.</p></div>
      <div aria-label="Zo Shared Drives pairing and mount architecture" className="build-cluster-diagram">
        <article className="build-cluster-node build-cluster-source"><span className="build-node-label">01 · Source Zo Computer</span><HardDrive size={23} /><h3>Owner’s Drive</h3><p>Selected folder, invitation record and scoped peer permission.</p><div>Owns the live files</div></article>
        <div className="build-cluster-flow"><span>One-time invitation</span><i>→</i><span>Scoped peer key</span><i>→</i><span>HTTPS proxy calls</span></div>
        <article className="build-cluster-node"><span className="build-node-label">02 · Connected Zo Computer</span><Network size={23} /><h3>Mounted Drive</h3><p>Lists and changes the source folder through the source Drive API.</p><div>Keeps a private read cache</div></article>
      </div>
      <ol className="build-cluster-steps"><li><span>01</span><p><strong>Invite a folder.</strong> The owner creates a one-time invitation with viewer or editor access.</p></li><li><span>02</span><p><strong>Pair a Zo Drive.</strong> The receiving Zo exchanges the invitation with the source over HTTPS and receives scoped peer credentials.</p></li><li><span>03</span><p><strong>Mount live work.</strong> Reads and writes are forwarded to the source; revoking the peer removes that access.</p></li></ol>
    </section>

    <section className="build-callout"><p className="build-kicker">The operating model</p><h2>Work locally when it helps.<br />Keep Zo authoritative.</h2><p>Run <code>zo-drive configure</code> on a local machine, save a scoped device key, and use the public Zo Drive URL over HTTPS. You get a normal developer workflow without moving the system of record off the Zo Computer.</p><a className="build-primary-link" href={docsUrl}>Read the setup guide <ArrowUpRight size={16} /></a></section>

    <footer className="build-footer"><BuildBrand homeUrl={homeUrl} logoCloudUrl={logoCloudUrl} logoPegasusUrl={logoPegasusUrl} /><span>Built on Zo Computer</span><a href={driveUrl}>Open Zo Drive</a></footer>
  </main>;
}

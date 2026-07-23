import {
  ArrowRight,
  Bot,
  Check,
  Code2,
  Database,
  FileText,
  HardDrive,
  KeyRound,
  LockKeyhole,
  Network,
  Play,
  Search,
  Send,
  Sparkles,
  Terminal,
  Upload,
  UsersRound
} from "lucide-react";
import { useState } from "react";

type LandingPageTwoProps = {
  currentLandingUrl: string;
  docsUrl: string;
  driveUrl: string;
  loginUrl: string;
  logoCloudUrl: string;
  logoPegasusUrl: string;
};

const products = [
  {
    name: "Zo Paste",
    short: "Paste",
    promise: "Publish one precise note, not your whole Drive.",
    description: "Private notes and code become view-only or editable links with passcodes, expiry and revocation.",
    section: "pastes",
    icon: Code2,
    colour: "#4f7cff",
    tint: "#dfe7ff",
    items: ["launch-notes.md", "Markdown", "Passcode protected", "7-day expiry"]
  },
  {
    name: "Zo Transfer",
    short: "Transfer",
    promise: "Deliver the file. Keep the folder closed.",
    description: "Send files through purpose-built public or passcode-protected links with visible expiry and revoke controls.",
    section: "transfer",
    icon: Send,
    colour: "#ff6e58",
    tint: "#ffe1dc",
    items: ["launch-film.mp4", "2.4 GB", "Passcode access", "Ready to send"]
  },
  {
    name: "Zo Functions",
    short: "Functions",
    promise: "Put automation beside the data it serves.",
    description: "Run JavaScript and Python manually, on a UTC schedule or through an endpoint you deliberately expose.",
    section: "functions",
    icon: Terminal,
    colour: "#7558d9",
    tint: "#e9e2ff",
    items: ["weekly-report.js", "JavaScript", "Monday 09:00", "Private endpoint"]
  },
  {
    name: "Zo Databases",
    short: "Databases",
    promise: "Persistent data without another cloud account.",
    description: "Install supported runtimes, create private databases and issue scoped credentials from one workspace.",
    section: "databases",
    icon: Database,
    colour: "#078a70",
    tint: "#d7f3ea",
    items: ["product.sqlite", "SQLite", "Persistent runtime", "Scoped HTTPS key"]
  },
  {
    name: "Zo Shared Drives",
    short: "Shared",
    promise: "Collaborate from the source, not a copy.",
    description: "Mount selected live folders for trusted people while ownership remains with the source Zo Computer.",
    section: "cluster-databases",
    icon: Network,
    colour: "#d38b14",
    tint: "#fff0ca",
    items: ["Research", "Editor role", "Live remote mount", "Private cache"]
  },
  {
    name: "ZominAI",
    short: "ZominAI",
    promise: "Ask private questions against current Drive context.",
    description: "Use a local model with authenticated read-only tools and a firm boundary against write operations.",
    section: "zominai",
    icon: Bot,
    colour: "#dc4e98",
    tint: "#f9ddec",
    items: ["What changed in Launch?", "Local model", "Read-only tools", "Answer ready"]
  }
];

const saasStack = [
  ["Pastebin Pro", "Pastes"],
  ["WeTransfer Ultimate", "Transfers"],
  ["Vercel Pro", "Functions"],
  ["Supabase Pro", "Databases"],
  ["Google Workspace", "Shared drives"],
  ["ChatGPT Plus", "AI"]
];

export function LandingPageTwo({
  currentLandingUrl,
  docsUrl,
  driveUrl,
  loginUrl,
  logoCloudUrl,
  logoPegasusUrl
}: LandingPageTwoProps) {
  const [activeProduct, setActiveProduct] = useState(0);
  const selected = products[activeProduct]!;
  const SelectedIcon = selected.icon;

  return (
    <main className="neo-page">
      <style>{`
        .neo-page {
          --surface: #e9eef3;
          --surface-light: #f7fafd;
          --ink: #18212a;
          --muted: #66717c;
          --blue: #4f7cff;
          background: var(--surface);
          color: var(--ink);
          font-family: "Avenir Next", "Nunito Sans", "Trebuchet MS", sans-serif;
          overflow: hidden;
        }
        .neo-title {
          font-family: "Avenir Next", "Helvetica Neue", sans-serif;
          font-size: clamp(4rem, 9.3vw, 8.7rem);
          font-weight: 800;
          letter-spacing: -.075em;
          line-height: .83;
        }
        .neo-raised {
          background: linear-gradient(145deg, #f4f8fc, #dce2e8);
          box-shadow: 18px 18px 42px #c4cbd2, -18px -18px 42px #ffffff;
        }
        .neo-raised-soft {
          background: #e9eef3;
          box-shadow: 11px 11px 25px #c8cfd6, -11px -11px 25px #ffffff;
        }
        .neo-inset {
          background: #e9eef3;
          box-shadow: inset 7px 7px 15px #cbd2d9, inset -7px -7px 15px #ffffff;
        }
        .neo-button {
          box-shadow: 7px 7px 15px rgba(153,163,173,.48), -7px -7px 15px rgba(255,255,255,.9);
          transition: box-shadow .2s ease, transform .2s ease;
        }
        .neo-button:hover {
          box-shadow: 4px 4px 10px rgba(153,163,173,.45), -4px -4px 10px rgba(255,255,255,.95);
          transform: translateY(1px);
        }
        .neo-button:active {
          box-shadow: inset 4px 4px 8px rgba(126,136,146,.38), inset -4px -4px 8px rgba(255,255,255,.8);
          transform: translateY(2px);
        }
        .neo-product-button {
          box-shadow: 8px 8px 18px #c6cdd4, -8px -8px 18px #ffffff;
          transition: color .25s ease, box-shadow .25s ease, transform .25s ease;
        }
        .neo-product-button:hover { transform: translateY(-2px); }
        .neo-product-button[aria-selected="true"] {
          box-shadow: inset 5px 5px 11px #c6cdd4, inset -5px -5px 11px #ffffff;
          transform: translateY(1px);
        }
        .neo-float {
          animation: neo-float 6s ease-in-out infinite;
        }
        .neo-pulse {
          animation: neo-pulse 2.8s ease-in-out infinite;
        }
        .neo-reveal {
          animation: neo-reveal .8s cubic-bezier(.2,.72,.2,1) both;
        }
        .neo-reveal-delay {
          animation: neo-reveal .8s .14s cubic-bezier(.2,.72,.2,1) both;
        }
        .neo-dots {
          background-image: radial-gradient(rgba(79,124,255,.18) 1px, transparent 1px);
          background-size: 18px 18px;
        }
        @keyframes neo-float {
          0%, 100% { transform: translateY(0) rotate(1deg); }
          50% { transform: translateY(-12px) rotate(-.5deg); }
        }
        @keyframes neo-pulse {
          0%, 100% { transform: scale(.92); opacity: .5; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes neo-reveal {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .neo-float, .neo-pulse, .neo-reveal, .neo-reveal-delay { animation: none; }
          .neo-button, .neo-product-button { transition: none; }
        }
      `}</style>

      <header className="relative z-20 px-4 pt-4 sm:px-7 sm:pt-6">
        <nav aria-label="Zo Drive concept navigation" className="neo-raised-soft mx-auto flex h-[4.5rem] max-w-[88rem] items-center justify-between rounded-[1.4rem] px-4 sm:px-6">
          <a className="flex items-center gap-3 text-sm font-extrabold" href={currentLandingUrl}>
            <span className="relative block size-10">
              <img alt="" className="absolute inset-0 size-full" src={logoCloudUrl} />
              <img alt="" className="absolute left-[5.94%] top-0 h-[88.44%] w-[88.44%]" src={logoPegasusUrl} />
            </span>
            Zo Drive
          </a>
          <div className="hidden items-center gap-7 text-xs font-bold text-[#66717c] md:flex">
            <a className="hover:text-[#18212a]" href="#control">Control</a>
            <a className="hover:text-[#18212a]" href="#suite">Products</a>
            <a className="hover:text-[#18212a]" href="#savings">Savings</a>
            <a className="hover:text-[#18212a]" href={docsUrl}>Docs</a>
          </div>
          <a className="neo-button inline-flex items-center gap-2 rounded-xl bg-[#4f7cff] px-4 py-2.5 text-xs font-extrabold text-white sm:px-5" href={loginUrl}>
            Open Drive <ArrowRight size={14} />
          </a>
        </nav>
      </header>

      <section className="neo-dots relative min-h-[calc(100vh-6rem)] px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
        <div className="pointer-events-none absolute left-[7%] top-[16%] size-56 rounded-full bg-[#4f7cff]/10 blur-3xl" />
        <div className="pointer-events-none absolute right-[6%] top-[8%] size-72 rounded-full bg-[#ff6e58]/10 blur-3xl" />
        <div className="mx-auto grid min-h-[calc(100vh-12rem)] max-w-[88rem] items-center gap-20 lg:grid-cols-[1.05fr_.95fr]">
          <div className="neo-reveal relative z-10">
            <div className="mb-8 flex items-center gap-3 text-xs font-extrabold uppercase tracking-[.17em] text-[#4f7cff]">
              <span className="neo-pulse block size-2.5 rounded-full bg-[#ff6e58]" />
              Private cloud / tactile control
            </div>
            <h1 className="neo-title">
              Your cloud
              <span className="block text-[#4f7cff]">has a home.</span>
            </h1>
            <p className="mt-9 max-w-xl text-lg leading-8 text-[#66717c]">
              Files, transfers, functions, databases, shared drives and local AI, operated from one private Zo Computer.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a className="neo-button inline-flex items-center gap-3 rounded-2xl bg-[#4f7cff] px-6 py-4 text-xs font-extrabold text-white" href={loginUrl}>
                Enter your Drive <ArrowRight size={15} />
              </a>
              <a className="neo-button inline-flex items-center gap-3 rounded-2xl bg-[#e9eef3] px-6 py-4 text-xs font-extrabold text-[#18212a]" href="#suite">
                Explore six products
              </a>
            </div>
          </div>

          <div className="neo-reveal-delay relative mx-auto w-full max-w-xl">
            <div className="neo-float neo-raised rounded-[2.3rem] p-4 sm:p-5">
              <div className="overflow-hidden rounded-[1.65rem] bg-[#f7fafd]">
                <div className="flex items-center justify-between border-b border-[#18212a]/8 px-5 py-4">
                  <div className="flex gap-2">
                    <span className="size-2.5 rounded-full bg-[#ff6e58]" />
                    <span className="size-2.5 rounded-full bg-[#f0c862]" />
                    <span className="size-2.5 rounded-full bg-[#72c49b]" />
                  </div>
                  <span className="text-[.65rem] font-extrabold text-[#66717c]">My Drive / Launch</span>
                  <Search size={15} className="text-[#66717c]" />
                </div>
                <div className="grid min-h-[28rem] grid-cols-[4.5rem_1fr] sm:grid-cols-[9rem_1fr]">
                  <aside className="bg-[#e9eef3] p-3 sm:p-4">
                    <div className="space-y-2 pt-2">
                      {[
                        [HardDrive, "My Drive", true],
                        [Sparkles, "ZominAI", false],
                        [Send, "Transfer", false],
                        [Database, "Databases", false]
                      ].map(([Icon, label, active]) => {
                        const NavIcon = Icon as typeof HardDrive;
                        return (
                          <div className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold ${active ? "neo-inset text-[#4f7cff]" : "text-[#66717c]"}`} key={String(label)}>
                            <NavIcon size={15} />
                            <span className="hidden sm:inline">{String(label)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </aside>
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[.62rem] font-extrabold uppercase tracking-[.14em] text-[#66717c]">Workspace</p>
                        <h2 className="mt-1 text-2xl font-extrabold">Launch</h2>
                      </div>
                      <button aria-label="Upload file" className="neo-button grid size-11 place-items-center rounded-2xl bg-[#ff6e58] text-white" type="button"><Upload size={17} /></button>
                    </div>
                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                      {[
                        ["Launch brief", "Document", FileText, "#4f7cff", "#dfe7ff"],
                        ["Campaign data", "Database", Database, "#078a70", "#d7f3ea"],
                        ["Product film", "Video", Play, "#ff6e58", "#ffe1dc"],
                        ["Partner notes", "Shared", UsersRound, "#d38b14", "#fff0ca"]
                      ].map(([name, type, Icon, colour, tint]) => {
                        const FileIcon = Icon as typeof FileText;
                        return (
                          <article className="neo-raised-soft rounded-2xl p-4" key={String(name)}>
                            <span className="grid size-9 place-items-center rounded-xl" style={{ background: String(tint), color: String(colour) }}><FileIcon size={16} /></span>
                            <h3 className="mt-5 text-sm font-extrabold">{String(name)}</h3>
                            <p className="mt-1 text-[.67rem] text-[#66717c]">{String(type)}</p>
                          </article>
                        );
                      })}
                    </div>
                    <div className="neo-inset mt-5 flex items-center justify-between rounded-2xl px-4 py-3">
                      <span className="flex items-center gap-2 text-xs font-extrabold text-[#078a70]"><Sparkles size={15} /> ZominAI ready</span>
                      <span className="size-2 rounded-full bg-[#54bd8b]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="neo-raised-soft absolute -bottom-8 -left-3 rounded-2xl px-5 py-4 sm:-left-12">
              <p className="text-[.6rem] font-extrabold uppercase tracking-[.14em] text-[#66717c]">Owner complete</p>
              <p className="mt-1 text-lg font-extrabold">Six products / one Drive</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 sm:px-8 lg:px-12" id="control">
        <div className="mx-auto grid max-w-[88rem] gap-5 md:grid-cols-3">
          {[
            [LockKeyhole, "Private first", "Nothing opens until you choose.", "#4f7cff", "#dfe7ff"],
            [KeyRound, "Scoped access", "Share a file, function or folder precisely.", "#078a70", "#d7f3ea"],
            [HardDrive, "Your source", "The system of record stays on your Zo.", "#ff6e58", "#ffe1dc"]
          ].map(([Icon, title, copy, colour, tint]) => {
            const ItemIcon = Icon as typeof LockKeyhole;
            return (
              <article className="neo-raised-soft rounded-[1.7rem] p-6 sm:p-7" key={String(title)}>
                <span className="grid size-12 place-items-center rounded-2xl" style={{ background: String(tint), color: String(colour) }}><ItemIcon size={21} /></span>
                <h2 className="mt-8 text-xl font-extrabold">{String(title)}</h2>
                <p className="mt-2 text-sm leading-6 text-[#66717c]">{String(copy)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 lg:px-12 lg:py-36">
        <div className="mx-auto max-w-[88rem]">
          <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
            <p className="text-xs font-extrabold uppercase tracking-[.17em] text-[#4f7cff]">One operating surface</p>
            <h2 className="text-5xl font-extrabold leading-[.98] tracking-[-.055em] sm:text-7xl lg:text-8xl">
              Control should feel <span className="text-[#ff6e58]">close.</span><br />Ownership should feel <span className="text-[#078a70]">obvious.</span>
            </h2>
          </div>
          <div className="mt-20 grid gap-6 md:grid-cols-3">
            {[
              ["01", "Keep", "Files and product data remain on the machine you control."],
              ["02", "Open", "Public access is a deliberate action, never the starting state."],
              ["03", "Compound", "Every new workflow begins beside your existing private context."]
            ].map(([number, title, copy]) => (
              <article className="neo-inset rounded-[1.8rem] p-7 sm:p-9" key={number}>
                <p className="text-4xl font-black text-[#4f7cff]">{number}</p>
                <h3 className="mt-16 text-2xl font-extrabold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#66717c]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 lg:px-12 lg:py-36" id="suite">
        <div className="mx-auto max-w-[88rem]">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[.17em] text-[#4f7cff]">The Zo Drive suite</p>
            <h2 className="mt-5 text-5xl font-extrabold leading-none tracking-[-.055em] sm:text-7xl">Six controls.<br /><span className="text-[#078a70]">One console.</span></h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[#66717c]">Switch between products without moving your work, identity or data to another vendor.</p>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" role="tablist" aria-label="Choose a Zo Drive product">
            {products.map((product, index) => {
              const Icon = product.icon;
              return (
                <button
                  aria-controls="neo-product-panel"
                  aria-selected={activeProduct === index}
                  className="neo-product-button rounded-2xl bg-[#e9eef3] p-4 text-left"
                  key={product.name}
                  onClick={() => setActiveProduct(index)}
                  role="tab"
                  style={{ color: activeProduct === index ? product.colour : "#66717c" }}
                  type="button"
                >
                  <span className="grid size-10 place-items-center rounded-xl" style={{ background: product.tint, color: product.colour }}><Icon size={18} /></span>
                  <span className="mt-5 block text-xs font-extrabold">{product.short}</span>
                </button>
              );
            })}
          </div>

          <div className="neo-raised mt-10 overflow-hidden rounded-[2.4rem] p-4 sm:p-6" id="neo-product-panel" role="tabpanel">
            <div className="grid gap-8 rounded-[1.8rem] p-5 sm:p-8 lg:grid-cols-[.88fr_1.12fr]" style={{ background: selected.tint }}>
              <div className="flex flex-col justify-between">
                <div>
                  <span className="grid size-14 place-items-center rounded-2xl text-white shadow-lg" style={{ background: selected.colour }}><SelectedIcon size={25} /></span>
                  <p className="mt-10 text-xs font-extrabold uppercase tracking-[.16em]" style={{ color: selected.colour }}>{selected.name}</p>
                  <h3 className="mt-4 max-w-xl text-4xl font-extrabold leading-[1.02] tracking-[-.04em] sm:text-5xl">{selected.promise}</h3>
                  <p className="mt-5 max-w-xl text-sm leading-6 text-[#59646e]">{selected.description}</p>
                </div>
                <a className="mt-8 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.13em]" href={`${driveUrl}&section=${selected.section}`} style={{ color: selected.colour }}>
                  Open {selected.name} <ArrowRight size={14} />
                </a>
              </div>
              <div className="neo-raised-soft rounded-[1.6rem] bg-[#e9eef3] p-5 sm:p-7">
                <div className="flex items-center justify-between border-b border-[#18212a]/10 pb-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl" style={{ background: selected.tint, color: selected.colour }}><SelectedIcon size={18} /></span>
                    <div>
                      <p className="text-[.62rem] font-extrabold uppercase tracking-[.13em] text-[#66717c]">Active workspace</p>
                      <p className="mt-1 text-sm font-extrabold">{selected.name}</p>
                    </div>
                  </div>
                  <span className="size-2.5 rounded-full" style={{ background: selected.colour }} />
                </div>
                <div className="mt-6 space-y-3">
                  {selected.items.map((item, index) => (
                    <div className={index === 0 ? "neo-inset flex items-center justify-between rounded-xl px-4 py-4" : "flex items-center justify-between rounded-xl border border-[#18212a]/8 bg-[#f7fafd] px-4 py-4"} key={item}>
                      <span className="text-xs font-bold text-[#59646e]">{index === 0 ? "Current" : ["Mode", "Access", "Status"][index - 1]}</span>
                      <span className="text-right text-xs font-extrabold">{item}</span>
                    </div>
                  ))}
                </div>
                <button className="neo-button mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold text-white" style={{ background: selected.colour }} type="button">
                  <Play size={13} fill="currentColor" /> Continue in {selected.short}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 lg:px-12 lg:py-36" id="savings">
        <div className="mx-auto max-w-[88rem]">
          <div className="grid gap-12 lg:grid-cols-[1fr_.7fr] lg:items-end">
            <h2 className="text-5xl font-extrabold leading-[.96] tracking-[-.055em] sm:text-7xl lg:text-8xl">
              Six bills become<br /><span className="text-[#4f7cff]">one private system.</span>
            </h2>
            <p className="max-w-lg text-base leading-7 text-[#66717c] lg:ml-auto">Keep the workflows. Remove the repeated subscriptions, identities and data silos.</p>
          </div>

          <div className="mt-16 grid gap-6 lg:grid-cols-2">
            <article className="neo-inset rounded-[2rem] p-6 sm:p-9" aria-label="Regular SaaS products">
              <p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#ff6e58]">Before / Six SaaS vendors</p>
              <ul className="mt-8 divide-y divide-[#18212a]/10">
                {saasStack.map(([product, job]) => (
                  <li className="flex items-center justify-between gap-4 py-3.5 text-sm" key={product}>
                    <span className="font-extrabold">{product}</span>
                    <span className="text-[#66717c]">{job}</span>
                  </li>
                ))}
              </ul>
              <div className="neo-raised-soft mt-7 rounded-2xl p-5">
                <p className="text-[.62rem] font-extrabold uppercase tracking-[.14em] text-[#66717c]">Published starting prices</p>
                <p className="mt-2 text-4xl font-black">US$104+<span className="text-base font-bold text-[#66717c]"> / month</span></p>
                <p className="mt-2 text-xs text-[#66717c]">Before Pastebin Pro and additional usage charges.</p>
              </div>
            </article>

            <article className="neo-raised rounded-[2rem] p-6 sm:p-9" aria-label="Zo Drive product suite">
              <p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#078a70]">After / Zo Drive</p>
              <ul className="mt-8 divide-y divide-[#18212a]/10">
                {products.map((product) => (
                  <li className="flex items-center justify-between gap-4 py-3.5 text-sm" key={product.name}>
                    <span className="font-extrabold">{product.name}</span>
                    <span className="grid size-6 place-items-center rounded-full" style={{ background: product.tint, color: product.colour }}><Check size={13} /></span>
                  </li>
                ))}
              </ul>
              <div className="mt-7 rounded-2xl bg-[#078a70] p-5 text-white shadow-[8px_8px_18px_rgba(45,92,80,.3),-8px_-8px_18px_#fff]">
                <p className="text-[.62rem] font-extrabold uppercase tracking-[.14em] text-[#c0eadc]">Additional SaaS cost</p>
                <p className="mt-2 text-4xl font-black">US$0<span className="text-base font-bold text-[#c0eadc]"> extra / feature</span></p>
                <p className="mt-2 text-xs text-[#c0eadc]">Included with Zo Drive on your Zo Computer.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 pt-24 sm:px-8 lg:px-12 lg:pb-24 lg:pt-36">
        <div className="neo-raised relative mx-auto max-w-[88rem] overflow-hidden rounded-[2.6rem] p-8 sm:p-12 lg:p-20">
          <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[#4f7cff]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-[35%] size-72 rounded-full bg-[#ff6e58]/10 blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#4f7cff]">Ready when you are</p>
              <h2 className="mt-5 max-w-5xl text-6xl font-extrabold leading-[.9] tracking-[-.065em] sm:text-8xl lg:text-9xl">Bring your<br /><span className="text-[#ff6e58]">cloud home.</span></h2>
              <p className="mt-8 max-w-xl text-base leading-7 text-[#66717c]">Build, share, automate and understand your data from the machine you control.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a className="neo-button inline-flex items-center gap-2 rounded-2xl bg-[#4f7cff] px-6 py-4 text-xs font-extrabold text-white" href={loginUrl}>Enter Zo Drive <ArrowRight size={14} /></a>
              <a className="neo-button inline-flex items-center gap-2 rounded-2xl bg-[#e9eef3] px-6 py-4 text-xs font-extrabold" href={docsUrl}>Read the guide</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[88rem] flex-wrap items-center justify-between gap-5 text-xs font-bold text-[#66717c]">
          <span className="flex items-center gap-2 text-[#18212a]"><HardDrive size={15} /> Zo Drive / Concept 02</span>
          <span>Decentralised cloud, on your Zo</span>
          <a className="text-[#18212a] hover:text-[#4f7cff]" href={currentLandingUrl}>Return to current landing page</a>
        </div>
      </footer>
    </main>
  );
}

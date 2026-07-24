export type ProductRelease = {
  version: `v${string}`;
  date: string;
  changes: string[];
};

export const GUI_VERSION = "1.42.26";
export const CLI_VERSION = "1.3.0";
export const ZOMINAI_VERSION = "1.10.0";

export const GUI_CHANGELOG: ProductRelease[] = [
  {
    version: "v1.42.26",
    date: "2026-07-24",
    changes: ["Consolidated the release history into durable product milestones and removed repetitive visual-tweak notes."]
  },
  {
    version: "v1.42.25",
    date: "2026-07-24",
    changes: ["Completed the cobalt landing experience with an animated remote-access terminal, source link, and a clear six-product ownership story.", "Reworked Zo Shared Drives with nested folder views, a compact share-or-join workflow, full-width workspace, and a Zo Transfer-style collaboration header."]
  },
  {
    version: "v1.42.0",
    date: "2026-07-23",
    changes: ["Added the selectable six-product suite, ownership comparison, remote CLI access guidance, and product walkthroughs to the landing page."]
  },
  {
    version: "v1.38.0",
    date: "2026-07-22",
    changes: ["Added Shared Drive offline cache, folder lifecycle controls, User access roles, browser themes, and the ZominAI workspace with read-only Drive tools."]
  },
  {
    version: "v1.10.0",
    date: "2026-07-21",
    changes: ["Added persistent Zo Database runtimes and workspaces, scoped HTTPS access, Zo Functions, Zo Paste links, and Shared Drive pairing and permissions."]
  },
  {
    version: "v0.3.0",
    date: "2026-07-20",
    changes: ["Added scoped, revocable, expiry-aware device credentials in the API Keys workspace."]
  }
];

export const CLI_CHANGELOG: ProductRelease[] = [
  {
    version: "v1.3.0",
    date: "2026-07-22",
    changes: ["Added terminal command families for Zo Paste, Zo Transfer, Zo Shared Drives, Zo Databases, and Zo Functions, with CRUD operations and JSON output for automation."]
  },
  {
    version: "v1.2.0",
    date: "2026-07-20",
    changes: ["Added familiar Drive file operations, dry runs, progress reporting, file inspection, server-side copy and move, Trash-backed removal, and health checks."]
  },
  {
    version: "v1.1.0",
    date: "2026-07-20",
    changes: ["Added secure interactive configuration for the Zo Drive URL and a scoped device API key, stored with owner-only permissions."]
  },
  {
    version: "v1.0.0",
    date: "2026-07-20",
    changes: ["Replaced password-based terminal login with scoped, revocable per-device API keys."]
  }
];

export const ZOMINAI_CHANGELOG: ProductRelease[] = [
  {
    version: "v1.10.0",
    date: "2026-07-24",
    changes: ["Added owner-only managed installation and removal for the selected Bonsai model version, stored outside Drive quota."]
  },
  {
    version: "v1.9.0",
    date: "2026-07-23",
    changes: ["Added deterministic recursive Drive inventory summaries and model warm-up with explicit ready and retry states."]
  },
  {
    version: "v1.7.0",
    date: "2026-07-22",
    changes: ["Added authenticated time and Drive tools, streaming cancellation, reliable follow-up context, response-speed metadata, and retryable runtime failures."]
  },
  {
    version: "v1.5.0",
    date: "2026-07-22",
    changes: ["Added runtime-backed model selection, bounded custom system instructions, and authenticated read-only storage and file-count answers."]
  },
  {
    version: "v1.0.0",
    date: "2026-07-22",
    changes: ["Established the private local-AI product with a Bonsai runtime, browser-local chat history, and read-only Drive context."]
  }
];

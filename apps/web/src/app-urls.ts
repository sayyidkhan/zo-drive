export function normalizeAppBasePath(value: string): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

export function createDriveUrls(appBasePath: string) {
  const driveHomeUrl = () => `${window.location.origin}${appBasePath || "/"}`;
  const landingUrl = () => appBasePath || "/";
  const driveAppUrl = () => `${driveHomeUrl()}?app=1`;
  const loginUrl = () => `${driveHomeUrl()}?login=1`;
  const docsUrl = (mode: "gui" | "cli" = "gui", page: "docs" | "changelog" = "docs") =>
    `${driveHomeUrl()}?docs=1&mode=${mode}${page === "changelog" ? "&page=changelog" : ""}`;
  const releasesUrl = (mode: "gui" | "cli" = "gui") => `${driveHomeUrl()}?releases=1&mode=${mode}`;
  const zominAiDocsUrl = (page: "docs" | "changelog" = "docs") =>
    `${driveHomeUrl()}?docs=1&product=zominai${page === "changelog" ? "&page=changelog" : ""}`;
  const zominAiReleasesUrl = () => `${driveHomeUrl()}?releases=1&product=zominai`;
  const shareLink = (id: string) => `${driveHomeUrl()}?share=${encodeURIComponent(id)}`;
  const formLink = (id: string) => `${driveHomeUrl()}?form=${encodeURIComponent(id)}`;

  return {
    docsUrl,
    driveAppUrl,
    driveHomeUrl,
    formLink,
    landingUrl,
    loginUrl,
    releasesUrl,
    shareLink,
    zominAiDocsUrl,
    zominAiReleasesUrl
  };
}

import { DriveApp } from "./drive-app.js";
import { createDriveUrls, normalizeAppBasePath } from "./app-urls.js";
import { BuildStoryPage } from "./features/public-site/build-story-page.js";

const appBasePath = normalizeAppBasePath(
  import.meta.env.VITE_ZO_DRIVE_APP_BASE_PATH ?? (import.meta.env.DEV ? "/" : "/drive")
);

const buildStoryPath = `${appBasePath}/how-zo-drive-is-built`;

export function PublicSiteRouter() {
  if (window.location.pathname !== buildStoryPath) return <DriveApp />;

  const { docsUrl, driveAppUrl, landingUrl } = createDriveUrls(appBasePath);
  return <BuildStoryPage
    docsUrl={docsUrl()}
    driveUrl={driveAppUrl()}
    homeUrl={landingUrl()}
    logoCloudUrl={`${appBasePath}/zo-drive-pegasus-cloud.svg`}
    logoPegasusUrl={`${appBasePath}/zo-pegasus.svg`}
  />;
}

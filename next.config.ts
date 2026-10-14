import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import createNextIntlPlugin from "next-intl/plugin";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  async headers() {
    // Build-level routing must mark this data-free shell even when a host does
    // not load the legacy middleware convention. Protected pages get no marker.
    return [{source: "/offline", headers: [{key: "X-Offline-Shell", value: "public-v1"}]}];
  },
  async redirects() {
    // Redirect before the authenticated shell streams. Its filter effects must
    // not swallow the legacy profile's redirect during hydration. Next keeps
    // incoming finding/Governance query parameters; target authorization stays
    // in the workspace and profile APIs.
    return [{
      source: "/app/flocks/:flockId",
      destination: "/app/flocks?flock=:flockId&details=1&filter_page_tab=overview",
      permanent: false,
    }];
  },
  turbopack: {
    root: process.cwd(),
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);

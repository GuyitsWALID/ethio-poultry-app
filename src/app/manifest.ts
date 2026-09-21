import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ethiopoultry Farm Operations",
    short_name: "Ethiopoultry",
    description: "Daily poultry farm work, records, stock, health, and sales.",
    start_url: "/app/farm-manager",
    display: "standalone",
    background_color: "#f7f4ed",
    theme_color: "#182c20",
    orientation: "any",
    icons: [
      { src: "/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/app-icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

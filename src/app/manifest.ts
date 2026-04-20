import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GMTTI CRM",
    short_name: "GMTTI",
    description: "GMTTI CRM - Enrollment Pipeline Management",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0f1a",
    theme_color: "#3b3bf7",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

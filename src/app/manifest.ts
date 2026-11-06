import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CattleVision · Dataset IA de ICS Bovino",
    short_name: "CattleVision",
    description:
      "Plataforma de captura anatômica padronizada para criação do dataset de Inteligência Artificial para ICS Bovino.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#090D16",
    theme_color: "#059669",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

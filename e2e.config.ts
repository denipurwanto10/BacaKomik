import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";

export default {
  targets: [
    {
      name: "web",
      engine: web({ viewport: { width: 1280, height: 800 } }),
      app: {
        // Pakai dev server yang sudah jalan di :3100 (jangan start lagi).
        url: "http://localhost:3100",
      },
    },
  ],
} satisfies E2EConfig;

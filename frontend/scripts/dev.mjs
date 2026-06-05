import { build, preview } from "vite";
import { createViteConfig } from "./viteConfig.mjs";

const config = createViteConfig();

await build(config);

const server = await preview({
  ...config,
  preview: {
    host: "0.0.0.0",
    port: 3000,
  },
});
server.printUrls();

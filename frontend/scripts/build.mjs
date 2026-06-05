import { build } from "vite";
import { createViteConfig } from "./viteConfig.mjs";

await build(createViteConfig());

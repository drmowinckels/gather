import { defineConfig } from "tsup";
import path from "node:path";

// Bundle @samkoma/core and samkoma-client into the CLI so `dist/index.js` is a
// self-contained executable with no runtime deps. samkoma-client is aliased to
// its source so we don't depend on its build output (no cross-package build
// ordering); core is a devDependency and inlined by default.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  noExternal: ["@samkoma/core", "samkoma-client"],
  esbuildOptions(options) {
    options.alias = {
      "samkoma-client": path.resolve("../client/src/index.ts"),
    };
  },
  clean: true,
});

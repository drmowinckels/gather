import { defineConfig } from "tsup";

// @samkoma/core is a devDependency, so tsup inlines it into the JS bundle; the
// published package therefore installs zero runtime dependencies.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  noExternal: ["@samkoma/core"],
  clean: true,
});

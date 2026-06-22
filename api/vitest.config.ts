import path from "node:path";
import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(__dirname, "migrations"),
  );
  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            bindings: {
              TEST_MIGRATIONS: migrations,
              ALLOWED_ORIGINS: "http://localhost:5173",
              WEB_BASE_URL: "http://localhost:5173",
              CREATE_LIMIT: "10",
              SUBMIT_LIMIT: "10",
              MAX_RESPONSES: "3",
            },
          },
        },
      },
    },
  };
});

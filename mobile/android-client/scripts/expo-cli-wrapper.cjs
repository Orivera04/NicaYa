const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const expoPackage = require.resolve("expo/package.json", { paths: [projectRoot] });
const cli = require.resolve("@expo/cli", { paths: [expoPackage] });
const expoNodeModules = path.dirname(path.dirname(expoPackage));
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: projectRoot,
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "production", FORCE_COLOR: "0", NODE_PATH: [expoNodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter) },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

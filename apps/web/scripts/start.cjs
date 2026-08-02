const { spawn } = require("node:child_process");

const port = process.env.PORT || "3000";
const next = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [next, "start", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (error) => {
  console.error("No se pudo iniciar MotoYa Web.", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

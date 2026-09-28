#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const binDir = path.join(root, "node_modules", ".bin");
const bin = path.join(binDir, "wrangler");
if (!fs.existsSync(binDir)) process.exit(0);

const shim = `#!/usr/bin/env node
const { spawnSync } = require("child_process");
const path = require("path");
const root = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const deployish =
  args[0] === "deploy" ||
  args[0] === "preview" ||
  (args[0] === "versions" && args[1] === "upload");
const cmd = deployish
  ? [path.join(root, "scripts/cf-deploy.mjs"), ...args]
  : [
      path.join(root, "node_modules/wrangler/bin/wrangler.js"),
      ...args,
    ];
const result = spawnSync(process.execPath, cmd, {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
`;

fs.writeFileSync(bin, shim, { mode: 0o755 });
const cmdShim = `${bin}.cmd`;
if (fs.existsSync(cmdShim) || process.platform === "win32") {
  fs.writeFileSync(
    cmdShim,
    `@echo off\r\nnode "${bin.replace(/\\/g, "\\\\")}" %*\r\n`,
  );
}

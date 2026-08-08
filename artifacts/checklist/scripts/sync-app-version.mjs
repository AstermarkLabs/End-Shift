import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(dir, "..", "package.json");
const appJsonPath = join(dir, "..", "app.json");

const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
const appJson = JSON.parse(readFileSync(appJsonPath, "utf8"));

appJson.expo.version = version;

writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);
execFileSync("git", ["add", "app.json"], { cwd: join(dir, "..") });

console.log(`Synced app.json expo.version -> ${version}`);

import { rmSync } from "node:fs";
import { join } from "node:path";

// Removes stale webpack chunk manifests. A .next directory left over from a
// different build/dev session is the cause of "Cannot read properties of
// undefined (reading 'call')" in webpack.js at runtime.
const target = join(process.cwd(), ".next");
rmSync(target, { recursive: true, force: true });
console.log("Cleared stale .next development cache.");

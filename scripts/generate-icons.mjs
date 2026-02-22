#!/usr/bin/env node
/**
 * Generate PWA icon PNGs from the source SVG.
 * Run once: node scripts/generate-icons.mjs
 * Requires: npm install --save-dev sharp
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const svgBuffer = readFileSync(resolve(root, "src/app/icon.svg"));

const icons = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of icons) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(resolve(root, "public", name));
  console.log(`Created public/${name} (${size}x${size})`);
}

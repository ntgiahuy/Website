/**
 * CLI smoke test: generate sample slab PDF.
 * Usage: npx tsx scripts/render-pdf.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { generateSlabPdf } from "../lib/pdf/generate";
import { createSampleS1 } from "../lib/sample";

async function main() {
  const root = resolve(__dirname, "..");
  const regular = readFileSync(resolve(root, "public/fonts/BeVietnamPro-Regular.ttf"));
  const bold = readFileSync(resolve(root, "public/fonts/BeVietnamPro-Bold.ttf"));
  const bytes = await generateSlabPdf(createSampleS1(), {
    regular: regular.buffer.slice(regular.byteOffset, regular.byteOffset + regular.byteLength),
    bold: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength),
  });
  const outDir = resolve(root, "../artifacts");
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, "KetCauSan_S1-sample.pdf");
  writeFileSync(out, bytes);
  console.log("Wrote", out, bytes.byteLength, "bytes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

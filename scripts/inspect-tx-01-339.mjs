// One-shot diagnostic: lists AcroForm fields + their widget rectangles in
// tx-01-339.pdf. Run with: node scripts/inspect-tx-01-339.mjs
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";

const bytes = await readFile("public/forms/tx-01-339.pdf");
const pdf = await PDFDocument.load(bytes);

console.log("Pages:", pdf.getPageCount());
pdf.getPages().forEach((p, i) => {
  const { width, height } = p.getSize();
  console.log(`  page[${i}]: ${width} x ${height}`);
});

const form = pdf.getForm();
const fields = form.getFields();
console.log("\nForm fields (with widget rects):");
for (const f of fields) {
  const name = f.getName();
  const type = f.constructor.name;
  // @ts-ignore — acroField is internal but stable for inspection
  const widgets = f.acroField.getWidgets?.() ?? [];
  const rects = widgets.map((w) => {
    const r = w.getRectangle();
    return `[x=${r.x.toFixed(0)} y=${r.y.toFixed(0)} w=${r.width.toFixed(0)} h=${r.height.toFixed(0)}]`;
  });
  console.log(`  ${type}  ${JSON.stringify(name)}  ${rects.join(" ")}`);
}

// One-shot functional test: mirrors the browser-side merge in
// ExemptionCertSignModal.tsx. Fills the page-2 AcroForm fields, overlays a
// 1x1 test signature, flattens, and writes /tmp/tx-01-339-test.pdf.
// Run with: node scripts/test-exemption-cert-gen.mjs
import { PDFDocument } from "pdf-lib";
import { readFile, writeFile } from "node:fs/promises";

const templateBytes = await readFile("public/forms/tx-01-339.pdf");
const pdf = await PDFDocument.load(templateBytes);
const form = pdf.getForm();

const customer = {
  name: "Test Customer",
  street: "123 Main St",
  cityStateZip: "Tyler, TX 75701",
  phone: "555-555-5555",
};
const seller = {
  name: "Atlas Spas and Swim Spas",
  street: "5511 Hwy 31 W",
  cityStateZip: "Tyler, TX 75709",
};

form.getTextField("Exemption purchaser").setText(customer.name);
form.getTextField("Exemption purchaser street").setText(customer.street);
form.getTextField("Exemption purchaser phone").setText(customer.phone);
form.getTextField("Exemption purchaser city").setText(customer.cityStateZip);

form.getTextField("Exempt seller").setText(seller.name);
form.getTextField("Exempt seller street").setText(seller.street);
form.getTextField("Exempt seller city").setText(seller.cityStateZip);

form.getTextField("Exempt item description").setText("Hot tub or swim spa");
form.getTextField("Exemption reason").setText("Hydrotherapy");

form.getTextField("Exempt purchaser title").setText("Owner");
form.getTextField("Exempt purchaser sig date").setText("05/27/2026");

// 1x1 transparent-ish PNG to confirm embedPng + drawImage path executes.
const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADAgH/Cn3qiAAAAABJRU5ErkJggg==";
const sigBytes = Buffer.from(PNG_1X1, "base64");
const sigImage = await pdf.embedPng(sigBytes);
const page2 = pdf.getPage(1);
page2.drawImage(sigImage, { x: 78, y: 123, width: 195, height: 20 });

form.flatten();

const merged = await pdf.save();
await writeFile("/tmp/tx-01-339-test.pdf", merged);

console.log("OK");
console.log("  pages:", pdf.getPageCount());
console.log("  out:  /tmp/tx-01-339-test.pdf");
console.log("  size:", merged.byteLength, "bytes");

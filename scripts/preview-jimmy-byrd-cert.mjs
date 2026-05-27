// Throwaway preview: renders what the signed cert will look like for Jimmy
// Byrd using the actual production code path. Signature is drawn as italic
// text as a placeholder — the real customer signature would be a PNG of
// their on-screen ink, embedded at the same coords.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile, writeFile } from "node:fs/promises";

const templateBytes = await readFile("public/forms/tx-01-339.pdf");
const pdf = await PDFDocument.load(templateBytes);
const form = pdf.getForm();

form.getTextField("Exemption purchaser").setText("Jimmy Byrd");
form.getTextField("Exemption purchaser street").setText("403 Porpoise Dr");
form.getTextField("Exemption purchaser phone").setText("0000000000");
form.getTextField("Exemption purchaser city").setText("Aransas Pass, TX 78336");

form.getTextField("Exempt seller").setText("Atlas Spas and Swim Spas");
form.getTextField("Exempt seller street").setText("5511 Hwy 31 W");
form.getTextField("Exempt seller city").setText("Tyler, TX 75709");

form.getTextField("Exempt item description").setText("Hot tub or swim spa");
form.getTextField("Exemption reason").setText("Hydrotherapy");

form.getTextField("Exempt purchaser title").setText("Owner");
form.getTextField("Exempt purchaser sig date").setText("05/27/2026");

// Signature placeholder — in the real flow this is the customer's actual
// canvas-drawn signature embedded as a PNG. Drawing italic text here gives
// the right visual sense of where ink lands.
const font = await pdf.embedFont(StandardFonts.TimesRomanItalic);
const page2 = pdf.getPage(1);
page2.drawText("Jimmy Byrd", {
  x: 90,
  y: 130,
  size: 18,
  font,
  color: rgb(0.05, 0.05, 0.25),
});

form.flatten();
pdf.removePage(0);

const merged = await pdf.save();
await writeFile("/tmp/jimmy-byrd-cert-preview.pdf", merged);
console.log("OK — /tmp/jimmy-byrd-cert-preview.pdf,", merged.byteLength, "bytes");

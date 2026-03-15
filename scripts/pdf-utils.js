/**
 * PDF UTILITIES — Roboto font (tildes, ñ, ¿¡) + GlorIA logo
 * Logo aspect ratio: 4.39:1 (215×49 px)
 */
const { jsPDF } = require("jspdf");
const fs = require("fs");
const path = require("path");

const LOGO_BASE64 = require("./gloria-logo-base64.js");
const LOGO_RATIO = 4.39;

function createPDF() {
  const doc = new jsPDF({ unit: "mm", format: "letter" });

  var regB64 = fs.readFileSync(path.join(__dirname, "../src/lib/roboto-regular.ts"), "utf8").match(/"(.+)"/)[1];
  var boldB64 = fs.readFileSync(path.join(__dirname, "../src/lib/roboto-bold.ts"), "utf8").match(/"(.+)"/)[1];
  doc.addFileToVFS("Roboto-Regular.ttf", regB64);
  doc.addFileToVFS("Roboto-Bold.ttf", boldB64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  doc.setFont("Roboto", "normal");

  var pw = doc.internal.pageSize.getWidth();
  var mg = 20;
  var mw = pw - mg * 2;
  var y = 20;

  function txt(text, size, bold, color) {
    doc.setFontSize(size || 10);
    doc.setFont("Roboto", bold ? "bold" : "normal");
    doc.setTextColor(color ? color[0] : 30, color ? color[1] : 30, color ? color[2] : 30);
    var lines = doc.splitTextToSize(text, mw);
    for (var i = 0; i < lines.length; i++) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.text(lines[i], mg, y);
      y += size ? size * 0.45 : 4.5;
    }
  }

  function sec(title) {
    if (y > 235) { doc.addPage(); y = 20; }
    y += 4;
    doc.setFillColor(74, 85, 162);
    doc.rect(mg, y - 4, mw, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("Roboto", "bold");
    doc.text(title, mg + 3, y + 1.5);
    y += 12;
  }

  function header(line1, line2, line3) {
    doc.setFillColor(74, 85, 162);
    doc.rect(0, 0, pw, 45, "F");

    // Logo blanco directo sobre header azul (proporciones 4.39:1)
    var logoH = 10;
    var logoW = logoH * LOGO_RATIO;
    var logoX = pw - mg - logoW;
    var logoY = 5;
    doc.addImage("data:image/png;base64," + LOGO_BASE64, "PNG", logoX, logoY, logoW, logoH);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("Roboto", "bold");
    doc.text(line1, mg, 16);
    if (line2) { doc.setFontSize(12); doc.text(line2, mg, 26); }
    if (line3) { doc.setFontSize(9); doc.setFont("Roboto", "normal"); doc.text(line3, mg, 36); }
    y = 55;
  }

  function footers(prefix) {
    var tp = doc.getNumberOfPages();
    for (var p = 1; p <= tp; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(150, 150, 150);
      doc.line(mg, 268, pw - mg, 268);
      doc.text(prefix + " — Página " + p + " de " + tp, mg, 272);
    }
  }

  function save(filename) {
    var buffer = Buffer.from(doc.output("arraybuffer"));
    fs.writeFileSync(path.join(__dirname, "../public", filename), buffer);
    console.log("  ✓ " + filename + " (" + Math.round(buffer.length / 1024) + " KB)");
  }

  return { doc: doc, txt: txt, sec: sec, header: header, footers: footers, save: save, setY: function(v) { y = v; }, getY: function() { return y; } };
}

module.exports = { createPDF: createPDF };

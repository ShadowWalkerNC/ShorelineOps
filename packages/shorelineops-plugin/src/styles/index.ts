export const SHARED_CSS = `
@page {
  size: Letter portrait;
  margin: 0.4in;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10pt;
  line-height: 1.2;
  color: #111;
  background: #fff;
}
.packet { margin: 0; padding: 0; }
.page {
  position: relative;
  width: 7.7in;
  height: 10.2in;
  overflow: hidden;
  page-break-after: always;
  page-break-inside: avoid;
  background: #fff;
  padding: 0.08in 0.1in;
}
.page:last-child { page-break-after: auto; }
.sheet-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.1in;
  border-bottom: 2px solid #111;
  padding-bottom: 0.05in;
  margin-bottom: 0.07in;
}
.sheet-title { font-size: 13pt; font-weight: 700; margin: 0; line-height: 1.1; }
.sheet-sub { font-size: 10pt; margin: 0.02in 0 0 0; }
.sheet-meta { font-size: 10pt; text-align: right; white-space: nowrap; }
table.grid {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
table.grid th, table.grid td {
  border: 1px solid #111;
  padding: 0.03in 0.045in;
  vertical-align: top;
  font-size: 10pt;
  line-height: 1.12;
  word-wrap: break-word;
}
table.grid th {
  background: #e8e8e8;
  font-weight: 700;
  text-align: center;
}
.meal-breakfast { background: #fff3b0; }
.meal-lunch { background: #ffd6e0; }
.meal-dinner { background: #cfe6ff; }
.band-prep { background: #d7f0d7; }
.band-dessert { background: #ffe3c2; }
.band-specials { background: #e4d7f5; }
.opt-block { margin: 0 0 0.03in 0; }
.opt-block:last-child { margin-bottom: 0; }
.circle {
  display: inline-block;
  width: 0.2in;
  height: 0.2in;
  line-height: 0.2in;
  border: 1.5px solid #111;
  border-radius: 999px;
  text-align: center;
  font-weight: 700;
  font-size: 10pt;
  margin-right: 0.04in;
  vertical-align: top;
  background: #fff;
}
.opt-text { font-size: 10pt; }
.item-list { margin: 0.02in 0 0 0.26in; padding: 0; list-style: disc; }
.item-list li { font-size: 10pt; margin: 0 0 0.015in 0; }
.blank {
  display: block;
  min-height: 0.28in;
  border: 1px solid #111;
  background: #fff;
}
.blank-tall { min-height: 0.55in; }
.blank-line {
  display: inline-block;
  min-width: 1.4in;
  border-bottom: 1px solid #111;
  min-height: 0.22in;
  vertical-align: bottom;
}
.write-row { display: flex; gap: 0.1in; margin-top: 0.05in; }
.write-cell { flex: 1; font-size: 10pt; }
.label { font-weight: 700; font-size: 10pt; }
.small-note { font-size: 10pt; }
.footer {
  margin-top: 0.06in;
  border-top: 1.5px solid #111;
  padding-top: 0.045in;
  font-size: 10pt;
}
.count-box {
  display: block;
  min-height: 0.3in;
  border: 1px solid #111;
  background: #fff;
}
.day-cell { font-weight: 700; background: #f2f2f2; }
.watermark {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 50;
}
.watermark span {
  display: block;
  font-size: 42pt;
  font-weight: 700;
  color: #c00;
  opacity: 0.09;
  transform: rotate(-30deg);
  letter-spacing: 0.02in;
  white-space: nowrap;
  border: 3px solid #c00;
  padding: 0.05in 0.2in;
  margin: 0.06in 0;
}
.review-banner {
  border: 2px solid #111;
  background: #ffe3e3;
  font-weight: 700;
  text-align: center;
  padding: 0.03in;
  margin-bottom: 0.06in;
  font-size: 10pt;
}
.sections { display: flex; flex-direction: column; gap: 0.06in; }
.prep-section { border: 1.5px solid #111; padding: 0.045in; }
.prep-section h3 { margin: 0 0 0.04in 0; font-size: 10pt; }
.kv { display: flex; gap: 0.12in; }
.kv div { flex: 1; }

/* Print hierarchy and writing space shared by all eight forms. */
.page .meal-breakfast { background: #fff0aa; }
.page .meal-lunch { background: #f9d4dc; }
.page .meal-dinner { background: #cfe5f6; }
.page .band-prep { background: #d4e8d4; }
.page .band-dessert { background: #ffe0b7; }
.page .band-specials { background: #e8def0; }
.facility { margin: 0 0 0.03in; font-size: 12pt; font-weight: 700; letter-spacing: 0.04em; }
.grid .blank, .grid .count-box { border: none; min-height: 0.28in; }
.resident-details { display: flex; justify-content: space-between; gap: 0.2in; margin: 0 0 0.07in; }
.resident-details .blank-line { min-width: 2.1in; }
.resident-details > span:last-child .blank-line { min-width: 1.1in; }
.resident-menu .opt-block { display: flex; align-items: flex-start; gap: 0.035in; margin-bottom: 0.035in; }
.resident-menu .opt-block:last-child { margin-bottom: 0; }
.resident-menu .circle { flex: 0 0 0.17in; width: 0.17in; height: 0.17in; line-height: 0.17in; margin: 0; }
.resident-menu .opt-text { line-height: 1.1; }
.resident-menu .day-cell { text-align: center; font-size: 10pt; padding-left: 0.015in; padding-right: 0.015in; }
.resident-menu th, .resident-menu td { padding: 0.03in; }
.resident-footer { margin-top: 0.05in; padding-top: 0.03in; }
.resident-footer .notes-line { min-height: 0.23in; }
.resident-footer .write-row { margin-top: 0.025in; }
.weekly-tally tbody td { height: 0.68in; vertical-align: middle; }
.weekly-tally .count-box { border-bottom: 1px solid #444; min-height: 0.38in; margin: 0 0.04in; }
.prep-columns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.08in; margin: 0.1in 0; }
.prep-columns h3, .section-heading { margin: 0 0 0.04in; padding: 0.04in; border: 1px solid #111; font-size: 10pt; }
.prep-columns table.grid th, .prep-columns table.grid td { padding: 0.025in; }
.cook-option { margin: 0 0 0.12in; }
.cook-option h3 { display:flex; justify-content:space-between; align-items:center; font-size:11pt; border:1px solid #111; padding:0.04in 0.06in; margin:0 0 0.05in; }
.option-count { font-size:10pt; font-weight:normal; }
.option-count .blank-line { min-width:0.75in; }
.option-description { margin:0 0 0.05in; font-size:10pt; }
.responsibility { padding:0.06in; border:1px solid #111; font-size:10pt; }
@media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

`;

// Builds docs/Personnel_Account_Form.docx — the printable form the library
// fills in to collect each personnel's account details (up to 10 people),
// for creating their accounts separately from the public registration.
//
// Run:  node docs/build-personnel-account-form.mjs
import JSZip from "jszip";
import { writeFileSync } from "node:fs";

const NAVY = "0B1330";
const JADE = "0F8A6B";
const SLATE = "475569";
const OUT = "docs/Personnel_Account_Form.docx";

/* --------------------------- XML primitives -------------------------- */
const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const run = (text, o = {}) =>
  `<w:r><w:rPr>${o.bold ? "<w:b/>" : ""}${o.italics ? "<w:i/>" : ""}${
    o.color ? `<w:color w:val="${o.color}"/>` : ""
  }${o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : ""}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;

function para(runs, o = {}) {
  const props = [];
  if (o.style) props.push(`<w:pStyle w:val="${o.style}"/>`);
  if (o.bullet != null)
    props.push(`<w:numPr><w:ilvl w:val="${o.bullet}"/><w:numId w:val="1"/></w:numPr>`);
  if (o.align) props.push(`<w:jc w:val="${o.align}"/>`);
  if (o.spacingBefore) props.push(`<w:spacing w:before="${o.spacingBefore}"/>`);
  if (o.pageBreak) return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  return `<w:p>${props.length ? `<w:pPr>${props.join("")}</w:pPr>` : ""}${runs}</w:p>`;
}

const emptyPara = () => para("");

function table(rows, widthsCm, options = {}) {
  const totalCm = widthsCm.reduce((sum, width) => sum + width, 0);
  const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="B9B4CE"/>`)
    .join("");
  const body = rows
    .map((cells, rowIndex) => {
      const height =
        rowIndex > 0 && options.rowHeightCm
          ? `<w:trHeight w:val="${Math.round(options.rowHeightCm * 567)}" w:hRule="atLeast"/>`
          : "";
      return `<w:tr>${height}${cells
        .map((text, cellIndex) => {
          const pct = Math.round((widthsCm[cellIndex] / totalCm) * 5000);
          const head = rowIndex === 0 && options.headFill;
          return `<w:tc><w:tcPr><w:tcW w:w="${pct}" w:type="pct"/>${
            head
              ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.headFill}"/>`
              : ""
          }</w:tcPr>${para(
            run(text, {
              bold: rowIndex === 0,
              size: options.size ?? 18,
              color: rowIndex === 0 ? NAVY : undefined,
            }),
            { align: options.align },
          )}</w:tc>`;
        })
        .join("")}</w:tr>`;
    })
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>${body}</w:tbl>${emptyPara()}`;
}

/* ------------------------------ content ----------------------------- */
const body = [];

body.push(
  para(run("Library Personnel — Account Creation Form", { bold: true, size: 40, color: NAVY }), { align: "center", spacingBefore: 200 }),
  para(run("Learning and Information Resource Center · City College of Calamba", { size: 22, color: JADE }), { align: "center" }),
  para(run("Use this form to collect the details of the library personnel who need a system account — up to 10 people per form. Fill in one row per person and hand the form to the system administrator. Each account is created individually, separately from the public registration.", { size: 20 }), { spacingBefore: 240 }),
);

for (const line of [
  "Every person needs their own Library ID and school email — both must be unique in the system.",
  "The password is the one they want to use: 8 to 72 characters. They can change it anytime with \"Forgot password\" on the login window.",
  "Role, Position and Department must come from the lists on the next page.",
  "The Admin role can only be given by an admin — mark it only for people who manage the whole system.",
  "Keep this form private (it lists passwords) and delete it after the accounts are created.",
])
  body.push(para(run(line, { size: 19 }), { bullet: 0 }));

body.push(para(run("", { size: 8 })));

/* The 10-person grid */
const HEAD = [
  "No.",
  "Library ID",
  "First name",
  "M.I.",
  "Surname",
  "Suffix",
  "Role",
  "Position",
  "Department",
  "School email",
  "Password (8–72 characters)",
];
const WIDTHS = [0.9, 2.6, 2.7, 1.1, 2.7, 1.6, 2.4, 2.4, 2.6, 4.4, 3.3];
const rows = [HEAD];
for (let i = 1; i <= 10; i += 1) rows.push([String(i), "", "", "", "", "", "", "", "", "", ""]);
body.push(
  table(rows, WIDTHS, { rowHeightCm: 1.15, headFill: "F0EDFA", size: 18 }),
);

body.push(
  para(run("Role, Position and Department — see the choices on the next page. For a Faculty record, also write the Program (e.g. BSIT) in the Role column after the role, or on the back of this form.", { size: 17, italics: true, color: SLATE }), { spacingBefore: 60 }),
);

/* Page 2 — reference */
body.push(para("", { pageBreak: true }));
body.push(
  para(run("The valid choices", { bold: true, size: 32, color: NAVY })),
  para(run("Use exactly these words when filling in the form.", { size: 20, italics: true, color: SLATE }), { spacingBefore: 80 }),
);

body.push(
  para(run("Roles", { bold: true, size: 24, color: JADE }), { spacingBefore: 240 }),
  table(
    [
      ["Role", "Who it is"],
      ["Faculty", "Teaches subjects; can suggest books in Path Finder."],
      ["Staff", "Circulation desk work: attendance desk, borrowing, inventory, barcodes."],
      ["Non-teaching personnel", "Personnel without a teaching load."],
      ["Librarian", "Runs the library: catalog, validation, periods, reports and the AI tools."],
      ["Admin", "Full control of the system — settings, announcements, user management. Only an admin can give this role."],
    ],
    [5, 22.7],
    { size: 19, headFill: "F0EDFA" },
  ),
  para(run("Student accounts do not use this form — students register themselves, or their records come from the library validation process.", { size: 17, italics: true, color: SLATE })),
);

body.push(
  para(run("Positions", { bold: true, size: 24, color: JADE }), { spacingBefore: 240 }),
  table(
    [
      ["Position", "Notes"],
      ["COS", "Contract of Service."],
      ["Full Time", "Regular full-time personnel."],
      ["Part Time", "Part-time personnel."],
    ],
    [5, 22.7],
    { size: 19, headFill: "F0EDFA" },
  ),
);

body.push(
  para(run("Departments", { bold: true, size: 24, color: JADE }), { spacingBefore: 240 }),
  table(
    [
      ["Department", "Name"],
      ["DAS", "Department of Arts and Sciences"],
      ["DBA", "Department of Business and Accounting"],
      ["DCI", "Department of Computing and Informatics"],
      ["DTE", "Department of Teacher Education"],
    ],
    [5, 22.7],
    { size: 19, headFill: "F0EDFA" },
  ),
);

body.push(
  para(run("Programs (only for Faculty records — leave blank for everyone else)", { bold: true, size: 24, color: JADE }), { spacingBefore: 240 }),
  table(
    [
      ["Program codes"],
      ["BAC · BECED · BEED · BS-F · BSA · BSAIS · BSCS · BSE-E"],
      ["BSE-F · BSE-M · BSE-S · BSE-SS · BSED · BSIT · BSP · BSPSY"],
    ],
    [27.7],
    { size: 19, headFill: "F0EDFA" },
  ),
);

body.push(
  para(run("Field rules", { bold: true, size: 24, color: JADE }), { spacingBefore: 240 }),
  para(run("Library ID: required, up to 120 characters (their library card number).", { size: 19 }), { bullet: 0 }),
  para(run("First name and Surname: required, up to 100 characters each.", { size: 19 }), { bullet: 0 }),
  para(run("M.I.: up to 2 characters. Suffix: up to 20 characters (e.g. Jr., III).", { size: 19 }), { bullet: 0 }),
  para(run("School email: one per person, used as their login name.", { size: 19 }), { bullet: 0 }),
  para(run("Password: 8–72 characters, chosen by the person.", { size: 19 }), { bullet: 0 }),
);

/* --------------------------- docx assembly -------------------------- */
const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body.join("")}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="567" w:right="567" w:bottom="567" w:left="567" w:header="340" w:footer="340" w:gutter="0"/></w:sectPr></w:body>
</w:document>`;

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
</w:styles>`;

const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="420" w:hanging="280"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Library Personnel — Account Creation Form</dc:title>
<dc:creator>LIRC Library System</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`;

const zip = new JSZip();
zip.file("[Content_Types].xml", contentTypes);
zip.file("_rels/.rels", relsXml);
zip.file("word/document.xml", documentXml);
zip.file("word/_rels/document.xml.rels", documentRels);
zip.file("word/styles.xml", stylesXml);
zip.file("word/numbering.xml", numberingXml);
zip.file("docProps/core.xml", coreXml);

const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(OUT, buffer);
console.log(`Wrote ${OUT} (${buffer.length.toLocaleString()} bytes)`);

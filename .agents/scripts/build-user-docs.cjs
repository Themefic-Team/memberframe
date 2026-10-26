#!/usr/bin/env node
/**
 * Builds the user docs (user-docs/source/*.md) into Microsoft Word files.
 *
 *   node .agents/scripts/build-user-docs.cjs
 *
 * Writes:
 *   user-docs/MemberFrame-Help-Docs.docx   every page in order, one per section
 *   user-docs/pages/<page>.docx            one file per page, to paste into a Google Docs tab
 *
 * No dependencies: a .docx is a zip of XML parts, written here with stored
 * (uncompressed) entries, which Word and Google Docs both open.
 *
 * The Markdown it reads is a small subset, the one the pages use:
 *   # H1 (the page title), ## H2, ### H3, paragraphs, "- " bullets,
 *   "1. " numbered steps, | tables |, "> " notes, **bold**, `code`, [text](link),
 *   and placeholder lines like [Add Tier Popup Screenshot], drawn highlighted.
 * A link to another page (`other-page.md`) jumps to that page in the combined
 * file, and reads as plain text in a single-page file.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..", "user-docs");
const SOURCE = path.join(ROOT, "source");
const PAGES_OUT = path.join(ROOT, "pages");
const COMBINED = path.join(ROOT, "MemberFrame-Help-Docs.docx");
const TITLE = "MemberFrame Help Docs";

// ---------------------------------------------------------------------------
// Pages, in reading order: numbered files, then the integrations folder.
// ---------------------------------------------------------------------------

function listPages() {
  const pages = [];
  const walk = (dir, group) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full, name);
      else if (name.endsWith(".md")) {
        const markdown = fs.readFileSync(full, "utf8").replace(/\r\n/g, "\n");
        const title = (markdown.match(/^# (.+)$/m) || [, name])[1].trim();
        pages.push({ file: name, slug: name.replace(/\.md$/, ""), group, title, markdown });
      }
    }
  };
  walk(SOURCE, null);
  return pages;
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

const esc = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const bookmarkName = (slug) => `p_${slug.replace(/[^A-Za-z0-9]/g, "_")}`.slice(0, 40);

/** One document being written: its body, its links, and its list instances. */
class DocWriter {
  constructor({ combined, pageSlugs }) {
    this.combined = combined;
    this.pageSlugs = pageSlugs;
    this.body = [];
    this.rels = [];
    this.nums = [];
    this.bookmarkId = 0;
  }

  externalRel(url) {
    const id = `rIdL${this.rels.length + 1}`;
    this.rels.push({ id, url });
    return id;
  }

  newNumbered() {
    const numId = 10 + this.nums.length;
    this.nums.push(numId);
    return numId;
  }

  /** Inline Markdown to runs: **bold**, `code`, [text](link). */
  runs(text, base = {}) {
    const out = [];
    const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
    let last = 0;
    let match;
    while ((match = pattern.exec(text))) {
      if (match.index > last) out.push(this.run(text.slice(last, match.index), base));
      if (match[2] !== undefined) out.push(...this.runs(match[2], { ...base, bold: true }));
      else if (match[3] !== undefined) out.push(this.run(match[3], { ...base, code: true }));
      else out.push(this.link(match[4], match[5], base));
      last = pattern.lastIndex;
    }
    if (last < text.length) out.push(this.run(text.slice(last), base));
    return out.join("");
  }

  run(text, { bold, code, link, color, size, italic } = {}) {
    if (!text) return "";
    const props = [
      link ? '<w:rStyle w:val="Hyperlink"/>' : "",
      code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>' : "",
      bold ? "<w:b/>" : "",
      italic ? "<w:i/>" : "",
      color ? `<w:color w:val="${color}"/>` : "",
      code ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F3F5"/>' : "",
      size ? `<w:sz w:val="${size}"/>` : "",
    ].join("");
    return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  }

  link(label, href, base) {
    const page = href.match(/^(?:\.\.\/|\.\/)?(?:[a-z0-9-]+\/)?([a-z0-9-]+)\.md$/);
    if (page) {
      const slug = page[1];
      if (this.combined && this.pageSlugs.has(slug)) {
        return `<w:hyperlink w:anchor="${bookmarkName(slug)}">${this.runs(label, { ...base, link: true })}</w:hyperlink>`;
      }
      return this.runs(label, { ...base, bold: true });
    }
    if (/^https?:\/\//.test(href)) {
      const id = this.externalRel(href);
      return `<w:hyperlink r:id="${id}">${this.runs(label, { ...base, link: true })}</w:hyperlink>`;
    }
    return this.runs(label, base);
  }

  paragraph(inner, { style, numId, keepNext, pageBreakBefore, bookmark } = {}) {
    const props = [
      style ? `<w:pStyle w:val="${style}"/>` : "",
      keepNext ? "<w:keepNext/>" : "",
      pageBreakBefore ? "<w:pageBreakBefore/>" : "",
      numId !== undefined ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>` : "",
    ].join("");
    let content = inner;
    if (bookmark) {
      const id = this.bookmarkId++;
      content = `<w:bookmarkStart w:id="${id}" w:name="${bookmark}"/>${inner}<w:bookmarkEnd w:id="${id}"/>`;
    }
    this.body.push(`<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${content}</w:p>`);
  }

  table(rows) {
    const [head, ...rest] = rows;
    // The first column names a setting, so it is narrower; the rest share what is left.
    const total = 9360;
    const first = head.length === 1 ? total : Math.round(total * (head.length === 2 ? 0.32 : 0.24));
    const widths = head.map((_, i) => (i === 0 ? first : Math.floor((total - first) / (head.length - 1))));
    const cell = (text, header, i) =>
      `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/>${header ? '<w:shd w:val="clear" w:color="auto" w:fill="EEF1FF"/>' : ""}</w:tcPr>` +
      `<w:p><w:pPr><w:pStyle w:val="TableText"/></w:pPr>${this.runs(text, header ? { bold: true } : {})}</w:p></w:tc>`;
    const xml =
      `<w:tbl><w:tblPr><w:tblStyle w:val="DocTable"/><w:tblW w:w="${total}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1"/></w:tblPr>` +
      `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>` +
      `<w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map((text, i) => cell(text, true, i)).join("")}</w:tr>` +
      rest.map((row) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map((text, i) => cell(text, false, i)).join("")}</w:tr>`).join("") +
      `</w:tbl>`;
    this.body.push(xml);
    this.paragraph("", { style: "Spacer" });
  }

  /** One page's Markdown into the body. */
  page(page, { first }) {
    const lines = page.markdown.split("\n");
    let i = 0;
    let numId = null;
    let paragraph = [];
    const flush = () => {
      if (paragraph.length) {
        this.paragraph(this.runs(paragraph.join(" ")));
        paragraph = [];
      }
    };
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed === "") {
        flush();
        if (!/^\d+\. /.test((lines[i + 1] || "").trim())) numId = null;
        i++;
        continue;
      }
      let m;
      if ((m = trimmed.match(/^(#{1,3}) (.+)$/))) {
        flush();
        numId = null;
        const level = m[1].length;
        if (level === 1) {
          this.paragraph(this.runs(m[2]), {
            style: "Heading1",
            pageBreakBefore: this.combined && !first,
            bookmark: this.combined ? bookmarkName(page.slug) : null,
          });
        } else {
          this.paragraph(this.runs(m[2]), { style: `Heading${level}`, keepNext: true });
        }
      } else if (/^\[Add .+(Screenshot|Video Tutorial)\]$/.test(trimmed)) {
        flush();
        this.paragraph(this.run(trimmed, { bold: true, color: "7A5B00" }), { style: "Placeholder" });
      } else if (trimmed.startsWith("|")) {
        flush();
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
          if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
          i++;
        }
        this.table(rows);
        continue;
      } else if (trimmed.startsWith("> ")) {
        flush();
        const quote = [];
        while (i < lines.length && lines[i].trim().startsWith(">")) {
          quote.push(lines[i].trim().replace(/^>\s?/, ""));
          i++;
        }
        this.paragraph(this.runs(quote.join(" ")), { style: "Note" });
        continue;
      } else if ((m = trimmed.match(/^- (.+)$/))) {
        flush();
        this.paragraph(this.runs(m[1]), { style: "ListParagraph", numId: 1 });
      } else if ((m = trimmed.match(/^\d+\. (.+)$/))) {
        flush();
        if (numId === null) numId = this.newNumbered();
        this.paragraph(this.runs(m[1]), { style: "ListParagraph", numId });
      } else {
        paragraph.push(trimmed);
      }
      i++;
    }
    flush();
  }

  contents(pages) {
    this.paragraph(this.runs("Contents"), { style: "Heading2" });
    let group = null;
    for (const page of pages) {
      if (page.group && page.group !== group) {
        group = page.group;
        this.paragraph(this.run(groupTitle(group), { bold: true }), { style: "ContentsGroup" });
      }
      this.paragraph(
        `<w:hyperlink w:anchor="${bookmarkName(page.slug)}">${this.run(page.title, { link: true })}</w:hyperlink>`,
        { style: page.group ? "Contents2" : "Contents1" }
      );
    }
  }
}

const groupTitle = (group) => group.replace(/^\d+-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ---------------------------------------------------------------------------
// Package parts
// ---------------------------------------------------------------------------

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function documentXml(writer) {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${writer.body.join("")}` +
    `<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="12240" w:h="15840"/>` +
    `<w:pgMar w:top="1300" w:right="1440" w:bottom="1300" w:left="1440" w:header="708" w:footer="600" w:gutter="0"/></w:sectPr>` +
    `</w:body></w:document>`
  );
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="1F2328"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="1800" w:after="200"/></w:pPr><w:rPr><w:b/><w:sz w:val="56"/><w:color w:val="1B2559"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="600"/></w:pPr><w:rPr><w:sz w:val="28"/><w:color w:val="5A6275"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="200"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:sz w:val="40"/><w:color w:val="1B2559"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:sz w:val="30"/><w:color w:val="1B2559"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1B2559"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="80"/><w:ind w:left="720"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Placeholder"><w:name w:val="Placeholder"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="E0A800"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FFF6D6"/><w:spacing w:before="120" w:after="200"/><w:ind w:left="160"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Note"><w:name w:val="Note"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="5271FF"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="EEF1FF"/><w:spacing w:before="120" w:after="200"/><w:ind w:left="160"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="40" w:after="40" w:line="264" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Spacer"><w:name w:val="Spacer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60" w:line="120" w:lineRule="exact"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Contents1"><w:name w:val="Contents 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Contents2"><w:name w:val="Contents 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/><w:ind w:left="400"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="ContentsGroup"><w:name w:val="Contents Group"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="60"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:rPr><w:sz w:val="18"/><w:color w:val="8A90A0"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="3B51B8"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="DocTable"><w:name w:val="Doc Table"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D5D9E2"/><w:left w:val="single" w:sz="4" w:color="D5D9E2"/><w:bottom w:val="single" w:sz="4" w:color="D5D9E2"/><w:right w:val="single" w:sz="4" w:color="D5D9E2"/><w:insideH w:val="single" w:sz="4" w:color="D5D9E2"/><w:insideV w:val="single" w:sz="4" w:color="D5D9E2"/></w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

function numberingXml(writer) {
  const bullet =
    '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:lvl></w:abstractNum>';
  const decimal =
    '<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>';
  const nums = writer.nums
    .map((id) => `<w:num w:numId="${id}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${NS}>${bullet}${decimal}<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${nums}</w:numbering>`;
}

const FOOTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t xml:space="preserve">${TITLE}  |  Page </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;

function packageParts(writer, title) {
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const rels = writer.rels
    .map((rel) => `<Relationship Id="${rel.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(rel.url)}" TargetMode="External"/>`)
    .join("");
  return {
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>',
    "_rels/.rels":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>',
    "word/_rels/document.xml.rels":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${rels}</Relationships>`,
    "word/document.xml": documentXml(writer),
    "word/styles.xml": STYLES,
    "word/numbering.xml": numberingXml(writer),
    "word/settings.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ${NS}><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`,
    "word/footer1.xml": FOOTER,
    "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>MemberFrame</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
    "docProps/app.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>MemberFrame docs builder</Application></Properties>',
  };
}

// ---------------------------------------------------------------------------
// Zip, stored entries
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const date = new Date();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, "utf8");
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

// ---------------------------------------------------------------------------
// Checks the writing rules can be held to mechanically (Doc-Instruction step 6)
// ---------------------------------------------------------------------------

function check(pages) {
  const problems = [];
  for (const page of pages) {
    const text = page.markdown;
    const where = page.group ? `${page.group}/${page.file}` : page.file;
    if (/[–—]/.test(text)) problems.push(`${where}: an en or em dash`);
    // Bold text is an exact UI label (the Home tab's Contact us), so it is skipped.
    const prose = text.replace(/`[^`]*`/g, "").replace(/\*\*[^*]+\*\*/g, "").replace(/\[[^\]]*\]\([^)]*\)/g, "");
    if (/\b(we|us|our|ours|we're|we've|we'll)\b/i.test(prose)) {
      const hit = prose.match(/.{0,30}\b(we|us|our|ours|we're|we've|we'll)\b.{0,30}/i);
      problems.push(`${where}: "we/us/our" in "${hit ? hit[0] : ""}"`);
    }
    // The feature list is listing copy, not a help page (Doc-Instruction step 2).
    const helpPage = !page.slug.endsWith("highlighted-features");
    if (helpPage && !/^\[Add .+ Video Tutorial\]$/m.test(text)) problems.push(`${where}: no video tutorial placeholder`);
    if (helpPage && !/^## What to read next$/m.test(text)) problems.push(`${where}: no "What to read next"`);
    for (const [, target] of text.matchAll(/\]\(([a-z0-9-/.]+\.md)\)/g)) {
      const slug = target.replace(/^.*\//, "").replace(/\.md$/, "");
      if (!pages.some((p) => p.slug === slug)) problems.push(`${where}: link to missing page ${target}`);
    }
    for (const placeholder of text.match(/\[Add [^\]]+\]/g) || []) {
      if (!/^\[Add [A-Z][A-Za-z0-9 ,]+ (Screenshot|Video Tutorial)\]$/.test(placeholder)) problems.push(`${where}: placeholder format ${placeholder}`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------

function main() {
  const pages = listPages();
  const problems = check(pages);
  if (problems.length) {
    console.error(`[User Docs] ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }
  const slugs = new Set(pages.map((page) => page.slug));

  // The combined file: title, contents, then every page on its own page.
  const all = new DocWriter({ combined: true, pageSlugs: slugs });
  all.paragraph(all.run(TITLE), { style: "Title" });
  all.paragraph(all.run("Every MemberFrame feature, setting, and flow, explained step by step for Framer creators."), { style: "Subtitle" });
  all.contents(pages);
  pages.forEach((page) => all.page(page, { first: false }));
  fs.writeFileSync(COMBINED, zip(packageParts(all, TITLE)));

  // One file per page, for one Google Docs tab each.
  fs.rmSync(PAGES_OUT, { recursive: true, force: true });
  for (const page of pages) {
    const one = new DocWriter({ combined: false, pageSlugs: slugs });
    one.page(page, { first: true });
    const dir = page.group ? path.join(PAGES_OUT, page.group) : PAGES_OUT;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${page.slug}.docx`), zip(packageParts(one, page.title)));
  }

  console.log(`[User Docs] Built ${pages.length} pages: ${path.relative(process.cwd(), COMBINED)} and ${path.relative(process.cwd(), PAGES_OUT)}/`);
}

main();

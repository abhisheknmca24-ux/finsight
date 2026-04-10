"use strict";

const fs = require("fs");
const path = require("path");
const axios = require("axios");

let pdfParse = null;
let Tesseract = null;
let pdfjsLib = null;
let createCanvas = null;

try {
  pdfParse = require("pdf-parse");
  console.log("[Parser] pdf-parse loaded");
} catch (_) {
  console.warn("[Parser] pdf-parse not available");
}

try {
  Tesseract = require("tesseract.js");
  console.log("[Parser] tesseract.js loaded");
} catch (_) {
  console.warn("[Parser] tesseract.js not available");
}

try {
  const pdfjsPath = require.resolve("pdfjs-dist/legacy/build/pdf.js");
  pdfjsLib = require(pdfjsPath);

  // Use the same native canvas module that pdfjs-dist resolves internally.
  // Mixing canvas 2.x and 3.x objects causes drawImage to fail on image-based PDFs.
  const pdfjsCanvasPath = require.resolve("canvas", { paths: [path.dirname(pdfjsPath)] });
  createCanvas = require(pdfjsCanvasPath).createCanvas;

  console.log("[Parser] pdfjs-dist + canvas loaded");
} catch (err) {
  console.warn("[Parser] pdfjs-dist/canvas unavailable:", err.message);
}

const MIN_TEXT_FOR_TEXT_PDF = 150;
const MIN_TEXT_AFTER_OCR = 50;
const LOW_TX_THRESHOLD = 5;
const OCR_SCALE = 3;
const TABLE_HEADER_WINDOW = 4;
const ROW_CONTINUATION_MAX_GAP = 28;
const OCR_SPACE_URL = "https://api.ocr.space/parse/image";
const OCR_SPACE_KEY = process.env.OCR_SPACE_API_KEY || "helloworld";

const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const START_DATE_RE =
  /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.](?:\d{2}|\d{4})|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{1,2}[-\/][A-Za-z]{3,9}[-\/]\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b/;
const DATE_TOKEN_RE =
  /(\d{1,2}[\/\-.]\d{1,2}[\/\-.](?:\d{2}|\d{4})|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{1,2}[-\/][A-Za-z]{3,9}[-\/]\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i;
const DECIMAL_AMOUNT_RE = /(?:₹\s*)?\d[\d,]*\.\d{1,2}(?:\s*(?:CR|DR))?/gi;
const HEADER_LINE_RE =
  /^(?:dated\s*:|customer information|bank information|customer name|customer id|ckycid|account number|address|a\/c open date|branch name|branch code|branch ifsc|branch address|statement of transactions|opening balance|closing balance|date\s*(?:\||\s)+particulars|date$|particulars$|instrument no|debit$|credit$|balance$|total(?:\s|\|)|this is an authenticated statement|please send your queries|visit us at:)/i;
const FOOTER_LINE_RE =
  /(?:this is an authenticated statement|system generated statement|signature not required|please send your queries|visit us at:|page\s+\d+\s+of\s+\d+)/i;

const cleanText = (text) => {
  if (!text) return "";
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
};

const cleanLine = (line) =>
  String(line || "")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s+/g, " ")
    .trim();

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const nearlyEqual = (left, right, tolerance = 0.15) =>
  Math.abs(round2(left) - round2(right)) <= tolerance;

const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
};

const parseAmountValue = (value) => {
  if (value === null || value === undefined) return null;

  const stripped = String(value)
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const match = stripped.match(/-?\d+(?:\.\d{1,2})?/);
  if (!match) return null;

  const parsed = Number.parseFloat(match[0]);
  if (!Number.isFinite(parsed) || Math.abs(parsed) >= 1000000000) return null;

  return parsed;
};

const parseBalanceToken = (token) => {
  if (!token) return null;

  const amount = parseAmountValue(token);
  if (amount === null) return null;

  const upper = String(token).toUpperCase();
  if (/\bDR\b/.test(upper)) {
    return { amount, signed: -Math.abs(amount), polarity: "dr" };
  }

  if (/\bCR\b/.test(upper)) {
    return { amount, signed: Math.abs(amount), polarity: "cr" };
  }

  return { amount, signed: amount, polarity: null };
};

const parseDateStr = (raw) => {
  if (!raw) return null;
  const value = String(raw).trim();

  let match = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (match) {
    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    if (!Number.isNaN(date.getTime()) && date.getFullYear() >= 2000) return date;
  }

  match = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (match) {
    const year = Number(match[3]) > 50 ? 1900 + Number(match[3]) : 2000 + Number(match[3]);
    const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
    if (!Number.isNaN(date.getTime())) return date;
  }

  match = value.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!Number.isNaN(date.getTime()) && date.getFullYear() >= 2000) return date;
  }

  match = value.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (match) {
    const month = MONTHS[match[2].toLowerCase().slice(0, 3)];
    if (month !== undefined) return new Date(Number(match[3]), month, Number(match[1]));
  }

  match = value.match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{4})$/);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month !== undefined) return new Date(Number(match[3]), month, Number(match[1]));
  }

  match = value.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (match) {
    const month = MONTHS[match[1].toLowerCase().slice(0, 3)];
    if (month !== undefined) return new Date(Number(match[3]), month, Number(match[2]));
  }

  return null;
};

const inferCategory = (description) => {
  const lower = String(description || "").toLowerCase();

  if (/npci|cashback/.test(lower)) return "cashback";
  if (/zomato|swiggy|zepto/.test(lower)) return "food";
  if (/bmtc|metro|bus|bmrc|redbus|uts/.test(lower)) return "travel";
  if (/mobile|internet|navi|recharge|fiber/.test(lower)) return "bills";
  if (/amazon|myntra|flipkart/.test(lower)) return "shopping";

  return "other";
};

const detectDirection = (description) => {
  const lower = ` ${String(description || "").toLowerCase()} `;

  if (
    /(\/dr\/|\/dr\b|\bdr\/|-dr\/|-dr\b|\bdebit\b|\bwithdrawal\b|\bdebited\b)/.test(lower)
  ) {
    return "debit";
  }

  if (
    /(\/cr\/|\/cr\b|\bcr\/|-cr\/|-cr\b|\bcredit\b|\bcredited\b|\brefund\b|\bcashback\b|\bint\.pd\b)/.test(
      lower
    )
  ) {
    return "credit";
  }

  return null;
};

const inferDirectionFromDescription = (description) => {
  const lower = ` ${String(description || "").toLowerCase()} `;

  if (
    /\b(salary|credited|credit|received|deposit|payment from|self transfer|refund|cashback|interest|int\.pd|imps-cr|neft cr)\b/.test(
      lower
    )
  ) {
    return "credit";
  }

  if (
    /\b(paid|sent using|sent to|withdrawal|debited|purchase|payment to|bill pay|upi out|dr)\b/.test(
      lower
    )
  ) {
    return "debit";
  }

  return null;
};

const shouldIgnoreLine = (line) => {
  if (!line) return true;
  if (HEADER_LINE_RE.test(line) || FOOTER_LINE_RE.test(line)) return true;
  return false;
};

const splitColumns = (line) => {
  if (!line) return [];

  if (line.includes("|")) {
    return line
      .split("|")
      .map((part) => cleanLine(part))
      .filter(Boolean);
  }

  return line
    .split(/\s{2,}/)
    .map((part) => cleanLine(part))
    .filter(Boolean);
};

const looksLikeNumericColumn = (column) => {
  if (!column) return false;
  DECIMAL_AMOUNT_RE.lastIndex = 0;
  return DECIMAL_AMOUNT_RE.test(column);
};

const getDecimalAmountMatches = (value) => {
  const matches = [];
  const regex = /(?:₹\s*)?\d[\d,]*\.\d{1,2}(?:\s*(?:CR|DR))?/gi;
  let match;

  while ((match = regex.exec(String(value || ""))) !== null) {
    matches.push({ value: match[0], index: match.index });
  }

  return matches;
};

const sanitizeDescription = (description) =>
  String(description || "")
    .replace(/\bTotal\b(?=\s*(?:\||\d)).*$/i, "")
    .replace(/\(?(?:This is a system generated statement\.?Signature not required)\)?/gi, "")
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const shouldJoinWithoutSpace = (current, next) => {
  if (!current || !next) return false;

  const prevChar = current[current.length - 1];
  const nextChar = next[0];

  if (/[\/@\-]/.test(prevChar) || /^[\/@\-]/.test(nextChar)) return true;
  if (/[a-z]/.test(nextChar)) return true;
  if (prevChar === "." && /\d/.test(nextChar)) return true;

  return false;
};

const mergeDescriptionParts = (parts) => {
  let merged = "";

  for (const rawPart of parts) {
    const part = sanitizeDescription(rawPart);
    if (!part) continue;

    if (!merged) {
      merged = part;
      continue;
    }

    merged += shouldJoinWithoutSpace(merged, part) ? part : ` ${part}`;
  }

  return sanitizeDescription(merged);
};

const buildTransactionBlocks = (lines) => {
  const blocks = [];
  let current = null;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    const dateMatch = line.match(START_DATE_RE);
    if (dateMatch && !shouldIgnoreLine(line)) {
      if (current) blocks.push(current);
      current = { dateText: dateMatch[1], lines: [line] };
      continue;
    }

    if (!current) continue;
    if (shouldIgnoreLine(line)) continue;

    current.lines.push(line);
  }

  if (current) blocks.push(current);

  return blocks;
};

const extractOpeningBalance = (lines) => {
  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!/opening balance/i.test(line)) continue;

    const matches = line.match(DECIMAL_AMOUNT_RE);
    if (!matches || matches.length === 0) continue;

    const balance = parseBalanceToken(matches[matches.length - 1]);
    if (balance) return balance.signed;
  }

  return null;
};

const dedupeTextItems = (items) => {
  const seen = new Set();
  const deduped = [];

  for (const item of items) {
    if (!item.str || !String(item.str).trim()) continue;

    const key = [
      round2(item.x * 10) / 10,
      round2(item.y * 10) / 10,
      String(item.str).trim(),
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
};

const groupItemsIntoLines = (items) => {
  const sorted = [...items].sort((left, right) => {
    if (Math.abs(left.y - right.y) <= 2) return left.x - right.x;
    return right.y - left.y;
  });

  const lines = [];

  for (const item of sorted) {
    let line = lines.find((entry) => Math.abs(entry.y - item.y) <= 2);
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }

  return lines;
};

const joinLineItems = (items) => {
  const sorted = [...items].sort((left, right) => left.x - right.x);
  let output = "";
  let previous = null;

  for (const item of sorted) {
    const text = String(item.str).replace(/\s+/g, " ").trim();
    if (!text) continue;

    if (!previous) {
      output += text;
      previous = item;
      continue;
    }

    const previousEnd = previous.x + previous.width;
    const previousCharWidth =
      previous.str && previous.str.length > 0 ? previous.width / previous.str.length : 0;
    const currentCharWidth = text.length > 0 ? item.width / text.length : 0;
    const separatorThreshold = Math.max(18, (previousCharWidth + currentCharWidth) * 3);
    const gap = item.x - previousEnd;

    output += gap > separatorThreshold ? " | " : " ";
    output += text;
    previous = item;
  }

  return cleanLine(output);
};

const buildLineEntries = (items) =>
  groupItemsIntoLines(items)
    .map((line) => ({
      y: line.y,
      items: [...line.items].sort((left, right) => left.x - right.x),
      text: joinLineItems(line.items),
    }))
    .filter((line) => line.text);

const extractDateToken = (value) => {
  const match = String(value || "").match(DATE_TOKEN_RE);
  return match ? match[1] : null;
};

const getHeaderX = (items, matcher) => {
  const matches = items
    .filter((item) => matcher.test(cleanLine(item.str)))
    .map((item) => Number(item.x || 0))
    .sort((left, right) => left - right);

  return matches.length > 0 ? matches[0] : null;
};

const detectTableSchema = (lineEntries) => {
  const firstDataIndex = lineEntries.findIndex(
    (entry) => START_DATE_RE.test(entry.text) && getDecimalAmountMatches(entry.text).length >= 1
  );

  if (firstDataIndex < 1) return null;

  const headerEntries = lineEntries.slice(Math.max(0, firstDataIndex - TABLE_HEADER_WINDOW), firstDataIndex);
  const headerItems = headerEntries.flatMap((entry) => entry.items);
  if (headerItems.length === 0) return null;

  const dateXs = headerItems
    .filter((item) => /\bdate\b/i.test(cleanLine(item.str)))
    .map((item) => Number(item.x || 0))
    .sort((left, right) => left - right);

  const primaryDateX = dateXs[0] ?? null;
  const valueDateX = dateXs.find((x) => primaryDateX !== null && x - primaryDateX > 25) ?? null;
  const referenceX = getHeaderX(headerItems, /\b(cheque|check|reference|ref(?:erence)?|utr|instrument)\b/i);
  const descriptionX = getHeaderX(
    headerItems,
    /\b(description|particulars?|narration|details?|remarks?)\b/i
  );
  const withdrawalX = getHeaderX(headerItems, /\b(withdrawals?|debits?|debit|dr)\b/i);
  const depositX = getHeaderX(headerItems, /\b(deposits?|credits?|credit|cr)\b/i);
  const balanceX = getHeaderX(headerItems, /\b(balance|running)\b/i);

  if (primaryDateX === null || descriptionX === null || balanceX === null) {
    return null;
  }

  const columns = [
    { key: "transactionDate", x: primaryDateX },
    valueDateX !== null ? { key: "valueDate", x: valueDateX } : null,
    referenceX !== null ? { key: "reference", x: referenceX } : null,
    { key: "description", x: descriptionX },
    withdrawalX !== null ? { key: "withdrawal", x: withdrawalX } : null,
    depositX !== null ? { key: "deposit", x: depositX } : null,
    { key: "balance", x: balanceX },
  ]
    .filter(Boolean)
    .sort((left, right) => left.x - right.x);

  if (columns.length < 4) return null;

  return {
    firstDataIndex,
    columns,
  };
};

const getColumnKeyForX = (x, columns) => {
  for (let index = 0; index < columns.length; index += 1) {
    const current = columns[index];
    const next = columns[index + 1];

    if (!next) return current.key;
    if (x < (current.x + next.x) / 2) return current.key;
  }

  return columns[columns.length - 1].key;
};

const getLineCells = (entry, columns) => {
  const cells = {};

  for (const item of entry.items) {
    const text = cleanLine(item.str);
    if (!text) continue;

    const key = getColumnKeyForX(Number(item.x || 0), columns);
    if (!cells[key]) cells[key] = [];
    cells[key].push(text);
  }

  const normalized = {};
  for (const column of columns) {
    const parts = cells[column.key] || [];
    normalized[column.key] =
      column.key === "description" || column.key === "reference"
        ? mergeDescriptionParts(parts)
        : cleanLine(parts.join(" "));
  }

  return normalized;
};

const finalizeStructuredTableRow = (row) => {
  if (!row) return null;

  const rawDate = row.transactionDate || row.valueDate || "";
  const date = parseDateStr(extractDateToken(rawDate));
  if (!date) return null;

  const description = mergeDescriptionParts([row.reference, row.description]);
  if (!description) return null;

  const withdrawal = parseAmountValue(row.withdrawal);
  const deposit = parseAmountValue(row.deposit);

  let amount = null;
  let type = null;

  if (withdrawal !== null && withdrawal > 0 && (deposit === null || deposit === 0)) {
    amount = round2(Math.abs(withdrawal));
    type = "expense";
  } else if (deposit !== null && deposit > 0 && (withdrawal === null || withdrawal === 0)) {
    amount = round2(Math.abs(deposit));
    type = "income";
  }

  if (amount === null || amount <= 0 || !type) return null;

  return {
    date: formatDate(date),
    amount,
    debit: type === "expense" ? amount : null,
    credit: type === "income" ? amount : null,
    type,
    description,
    category: inferCategory(description),
    source: "pdf",
    pattern: "structured-table",
  };
};

const extractTransactionsFromTableEntries = (lineEntries) => {
  const schema = detectTableSchema(lineEntries);
  if (!schema) return [];

  const firstColumn = schema.columns[0];
  const secondColumn = schema.columns[1];
  const firstDateBoundary = secondColumn ? (firstColumn.x + secondColumn.x) / 2 : firstColumn.x + 80;

  const transactions = [];
  let currentRow = null;

  const pushCurrentRow = () => {
    const transaction = finalizeStructuredTableRow(currentRow);
    if (transaction) {
      transactions.push(transaction);
    }
  };

  for (const entry of lineEntries.slice(schema.firstDataIndex)) {
    if (shouldIgnoreLine(entry.text)) continue;

    const cells = getLineCells(entry, schema.columns);
    const isRowStart = Boolean(extractDateToken(cells.transactionDate));

    if (isRowStart) {
      if (currentRow) pushCurrentRow();
      currentRow = { ...cells, lastY: entry.y };
      continue;
    }

    if (!currentRow) continue;

    const dateZoneText = mergeDescriptionParts(
      entry.items
        .filter((item) => Number(item.x || 0) < firstDateBoundary)
        .map((item) => item.str)
    );

    if (extractDateToken(dateZoneText)) {
      pushCurrentRow();
      currentRow = { ...cells, lastY: entry.y };
      continue;
    }

    if (Math.abs(entry.y - currentRow.lastY) > ROW_CONTINUATION_MAX_GAP) {
      pushCurrentRow();
      currentRow = null;
      continue;
    }

    for (const column of schema.columns) {
      const key = column.key;
      if (!cells[key]) continue;
      currentRow[key] =
        key === "description" || key === "reference"
          ? mergeDescriptionParts([currentRow[key], cells[key]])
          : cleanLine([currentRow[key], cells[key]].filter(Boolean).join(" "));
    }
    currentRow.lastY = entry.y;
  }

  if (currentRow) pushCurrentRow();

  return transactions;
};

const extractStructuredPDFData = async (buffer) => {
  if (!pdfjsLib) {
    return {
      lines: [],
      text: "",
      pages: 0,
      isTextPDF: false,
      openingBalance: null,
      tableTransactions: [],
    };
  }

  let pdfDocument;

  try {
    pdfDocument = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      disableFontFace: true,
      useSystemFonts: true,
    }).promise;
  } catch (err) {
    if (/password/i.test(err.message || "")) {
      throw new Error("Password-protected PDFs are not supported");
    }
    throw err;
  }

  const allLines = [];
  const tableTransactions = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = dedupeTextItems(
      content.items.map((item) => ({
        str: item.str,
        x: Number(item.transform[4] || 0),
        y: Number(item.transform[5] || 0),
        width: Number(item.width || 0),
      }))
    );

    const pageLineEntries = buildLineEntries(items);
    const pageLines = pageLineEntries.map((line) => line.text);

    allLines.push(...pageLines.filter(Boolean));
    tableTransactions.push(...extractTransactionsFromTableEntries(pageLineEntries));
  }

  const text = allLines.join("\n");

  return {
    lines: allLines,
    text,
    pages: pdfDocument.numPages,
    isTextPDF: text.length >= MIN_TEXT_FOR_TEXT_PDF,
    openingBalance: extractOpeningBalance(allLines),
    tableTransactions,
  };
};

const extractPDFText = async (buffer) => {
  if (!pdfParse) {
    const structured = await extractStructuredPDFData(buffer);
    return {
      text: structured.text,
      pages: structured.pages,
      isTextPDF: structured.isTextPDF,
    };
  }

  try {
    const data = await pdfParse(buffer);
    const text = cleanText(data.text || "");
    return {
      text,
      pages: data.numpages || 0,
      isTextPDF: text.length >= MIN_TEXT_FOR_TEXT_PDF,
    };
  } catch (err) {
    console.warn("[Parser] pdf-parse failed:", err.message);
    return { text: "", pages: 0, isTextPDF: false };
  }
};

const renderPDFToImages = async (buffer, scale = OCR_SCALE) => {
  if (!pdfjsLib || !createCanvas) return [];

  const tempDir = path.join(__dirname, "..", "uploads", "temp_ocr");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  let pdfDocument;
  try {
    pdfDocument = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      disableFontFace: true,
      useSystemFonts: true,
    }).promise;
  } catch (err) {
    if (/password/i.test(err.message || "")) {
      throw new Error("Password-protected PDFs are not supported");
    }
    throw err;
  }

  const imagePaths = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");

    await page.render({ canvasContext: context, viewport }).promise;

    const imagePath = path.join(tempDir, `ocr_page_${pageNumber}_${Date.now()}.png`);
    fs.writeFileSync(imagePath, canvas.toBuffer("image/png"));
    imagePaths.push(imagePath);
  }

  return imagePaths;
};

const ocrImage = async (imagePath) => {
  if (!Tesseract) throw new Error("tesseract.js not installed");

  const imageBuffer = Buffer.isBuffer(imagePath) ? imagePath : fs.readFileSync(imagePath);

  const result = await Tesseract.recognize(imageBuffer, "eng", {
    logger: (message) => {
      if (message.status === "recognizing text") {
        process.stdout.write(`\r[Parser] OCR ${Math.round(message.progress * 100)}%   `);
      }
    },
  });

  process.stdout.write("\n");
  return cleanText(result.data.text || "");
};

const ocrImages = async (imagePaths) => {
  let combined = "";

  for (const imagePath of imagePaths) {
    try {
      const pageText = await ocrImage(imagePath);
      if (pageText) combined += `\n${pageText}`;
    } catch (err) {
      console.warn(`[Parser] OCR failed for ${path.basename(imagePath)}:`, err.message);
    } finally {
      try {
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      } catch (_) {
        // best-effort cleanup
      }
    }
  }

  return combined.trim();
};

const ocrSpaceAPI = async (filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === ".pdf" ? "application/pdf" : "image/png";
    const base64 = fs.readFileSync(filePath).toString("base64");

    const body = new URLSearchParams({
      apikey: OCR_SPACE_KEY,
      language: "eng",
      filetype: ext === ".pdf" ? "PDF" : "PNG",
      isOverlayRequired: "false",
      base64Image: `data:${mime};base64,${base64}`,
    });

    const response = await axios.post(OCR_SPACE_URL, body.toString(), {
      timeout: 90000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const payload = response.data || {};
    if (payload.IsErroredOnProcessing) {
      const errorMessage = payload.ErrorMessage || payload.ErrorDetails || "OCR API error";
      throw new Error(Array.isArray(errorMessage) ? errorMessage.join("; ") : String(errorMessage));
    }

    const text = (payload.ParsedResults || [])
      .map((result) => (result && result.ParsedText ? result.ParsedText : ""))
      .join("\n");

    return cleanText(text);
  } catch (err) {
    console.warn("[Parser] OCR.space failed:", err.message);
    return "";
  }
};

const parseTransactionBlock = (block) => {
  if (!block || !block.lines || block.lines.length === 0) return null;

  const firstLine = cleanLine(block.lines[0]);
  const dateMatch = firstLine.match(START_DATE_RE);
  if (!dateMatch) return null;

  const date = parseDateStr(dateMatch[1]);
  if (!date) return null;

  const remainder = cleanLine(firstLine.slice(dateMatch[0].length));
  const firstColumns = splitColumns(remainder);
  const numericColumns = firstColumns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => looksLikeNumericColumn(column));
  const inlineAmountMatches = getDecimalAmountMatches(remainder);

  let balanceColumn = null;
  let amountColumn = null;
  let amountIndex = firstColumns.length;
  let inlineDescriptionPrefix = null;

  if (numericColumns.length >= 1) {
    balanceColumn = numericColumns[numericColumns.length - 1].column;
  }

  if (numericColumns.length >= 2) {
    const amountEntry = numericColumns[numericColumns.length - 2];
    amountColumn = amountEntry.column;
    amountIndex = amountEntry.index;
  }

  if (!amountColumn && inlineAmountMatches.length >= 1) {
    balanceColumn = inlineAmountMatches[inlineAmountMatches.length - 1].value;
  }

  if (!amountColumn && inlineAmountMatches.length >= 2) {
    amountColumn = inlineAmountMatches[inlineAmountMatches.length - 2].value;
    inlineDescriptionPrefix = remainder
      .slice(0, inlineAmountMatches[inlineAmountMatches.length - 2].index)
      .trim();
  } else if (!amountColumn && inlineAmountMatches.length === 1) {
    inlineDescriptionPrefix = remainder.slice(0, inlineAmountMatches[0].index).trim();
  }

  const descriptionParts = [];

  if (firstColumns.length > 0) {
    const cutIndex = amountColumn ? amountIndex : firstColumns.length;
    descriptionParts.push(...firstColumns.slice(0, cutIndex));
  } else if (remainder) {
    descriptionParts.push(remainder);
  }

  if (inlineDescriptionPrefix) {
    descriptionParts.length = 0;
    descriptionParts.push(inlineDescriptionPrefix);
  }

  for (const continuationLine of block.lines.slice(1)) {
    descriptionParts.push(cleanLine(continuationLine).replace(/\|/g, " "));
  }

  const description = mergeDescriptionParts(descriptionParts);
  if (!description) return null;

  let amount = parseAmountValue(amountColumn);

  if (amount === null || amount <= 0) return null;

  let direction = detectDirection(description);

  if (!direction) {
    direction = inferDirectionFromDescription(description) || "debit";
  }

  return {
    date: formatDate(date),
    amount: round2(amount),
    debit: direction === "debit" ? round2(amount) : null,
    credit: direction === "credit" ? round2(amount) : null,
    type: direction === "credit" ? "income" : "expense",
    description,
    category: inferCategory(description),
    source: "pdf",
    pattern: "date-block",
  };
};

const extractTransactionsFromLines = (lines) => {
  const blocks = buildTransactionBlocks(lines);
  const transactions = [];

  for (const block of blocks) {
    const transaction = parseTransactionBlock(block);
    if (!transaction) continue;

    transactions.push({
      date: transaction.date,
      amount: transaction.amount,
      debit: transaction.debit,
      credit: transaction.credit,
      type: transaction.type,
      description: transaction.description,
      category: transaction.category,
      source: transaction.source,
      pattern: transaction.pattern,
    });
  }

  return transactions;
};

const extractTransactionsFromText = (text) => {
  if (!text) return [];

  const lines = cleanText(text)
    .split("\n")
    .map((line) => cleanLine(line))
    .filter(Boolean);

  return extractTransactionsFromLines(lines);
};

const processPDF = async (filePath, startTime) => {
  const buffer = fs.readFileSync(filePath);
  let extractionMethod = "structured-pdf";
  let pages = 0;
  let text = "";
  let transactions = [];

  try {
    const structured = await extractStructuredPDFData(buffer);
    pages = structured.pages;
    text = structured.text;
    const lineTransactions = extractTransactionsFromLines(structured.lines, structured.openingBalance);
    const shouldPreferTable = structured.tableTransactions.length > 0;

    transactions =
      shouldPreferTable ? structured.tableTransactions : lineTransactions;
    extractionMethod =
      shouldPreferTable ? "structured-table" : "structured-pdf";
  } catch (err) {
    if (/password-protected/i.test(err.message || "")) throw err;
    console.warn("[Parser] Structured PDF extraction failed:", err.message);
  }

  if (transactions.length < LOW_TX_THRESHOLD) {
    const pdfText = await extractPDFText(buffer);
    const textTransactions = extractTransactionsFromText(pdfText.text);
    if (textTransactions.length > transactions.length) {
      text = pdfText.text;
      pages = pdfText.pages || pages;
      transactions = textTransactions;
      extractionMethod = "pdf-text";
    }
  }

  if (transactions.length < LOW_TX_THRESHOLD) {
    try {
      const imagePaths = await renderPDFToImages(buffer, OCR_SCALE);
      if (imagePaths.length > 0) {
        const ocrText = await ocrImages(imagePaths);
        const ocrTransactions = extractTransactionsFromText(ocrText);
        if (ocrTransactions.length > transactions.length) {
          text = ocrText;
          transactions = ocrTransactions;
          extractionMethod = "ocr-rendered";
        }
      }
    } catch (err) {
      if (/password-protected/i.test(err.message || "")) throw err;
      console.warn("[Parser] Rendered OCR fallback failed:", err.message);
    }
  }

  if (transactions.length < LOW_TX_THRESHOLD) {
    const apiText = await ocrSpaceAPI(filePath);
    const apiTransactions = extractTransactionsFromText(apiText);
    if (apiTransactions.length > transactions.length) {
      text = apiText;
      transactions = apiTransactions;
      extractionMethod = "ocr-api";
    }
  }

  const duration = Date.now() - startTime;

  return {
    transactions,
    metadata: {
      type: "pdf",
      extractionMethod,
      pages,
      textLength: text.length,
      transactionsFound: transactions.length,
      duration,
    },
  };
};

const processImageFile = async (filePath, startTime) => {
  const text = await ocrImage(filePath);
  const transactions = extractTransactionsFromText(text);

  return {
    transactions,
    metadata: {
      type: "image",
      extractionMethod: "ocr-image",
      textLength: text.length,
      transactionsFound: transactions.length,
      duration: Date.now() - startTime,
    },
  };
};

const processStatementFile = async (filePath, fileMeta = {}) => {
  const startTime = Date.now();
  const ext = path.extname(fileMeta.originalname || filePath).toLowerCase();
  const mime = String(fileMeta.mimetype || "").toLowerCase();

  if (ext === ".csv" || mime.includes("csv")) {
    const { parseCSVFile } = require("./parser");
    const rows = await parseCSVFile(filePath);
    return {
      transactions: rows,
      metadata: {
        type: "csv",
        rows: rows.length,
        duration: Date.now() - startTime,
      },
    };
  }

  if (ext === ".pdf" || mime.includes("pdf")) {
    return processPDF(filePath, startTime);
  }

  if (/\.(jpe?g|png|bmp|tiff?)$/i.test(ext) || mime.includes("image")) {
    return processImageFile(filePath, startTime);
  }

  throw new Error(`Unsupported file type: ${ext}`);
};

const columnTableParser = (text) => ({
  rows: extractTransactionsFromText(text),
  seen: new Set(),
});

const regexPatternExtract = (text) => extractTransactionsFromText(text);
const lineScanExtract = (text) => extractTransactionsFromText(text);
const tableScanExtract = (text) => extractTransactionsFromText(text);
const BANK_PATTERNS = [];

module.exports = {
  processStatementFile,
  extractPDFText,
  renderPDFToImages,
  ocrImage,
  ocrImages,
  ocrSpaceAPI,
  extractTransactionsFromText,
  columnTableParser,
  regexPatternExtract,
  lineScanExtract,
  tableScanExtract,
  cleanText,
  parseAmountValue,
  parseDateStr,
  BANK_PATTERNS,
  extractTextFromImage: ocrImage,
  extractWithOCRSpaceAPI: ocrSpaceAPI,
};

/**
 * SMART TRANSACTION PARSER (Updated)
 * ====================================
 * Hybrid document processing system combining:
 * - PDF text extraction (pdf-parse)
 * - OCR for scanned PDFs (Tesseract.js)
 * - PDF image rendering (pdfjs-dist + canvas)
 * - Multi-format bank pattern matching
 *
 * Supports formats from: PhonePe, Paytm, SBI, HDFC, ICICI, Axis, Kotak, PNB
 */

const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const { parseDate } = require("./dateNormalizer");
const {
  processStatementFile: processRobust,
  extractTransactionsFromText,
  parseAmountValue,
} = require("./statementParser");

let pdfParse;
try {
  pdfParse = require("pdf-parse");
} catch (_) {
  pdfParse = null;
}

// ─── CSV HEADER NORMALIZER ────────────────────────────────────────────────────
const normalizeHeader = ({ header }) => {
  if (!header) return "";
  return String(header).trim().toLowerCase().replace(/\s+/g, " ");
};

// ─── FIELD ALIAS MAP ──────────────────────────────────────────────────────────
const FIELD_ALIASES = {
  date: [
    "date", "transaction date", "txn date", "value date", "posted date",
    "time", "timestamp", "payment date", "transfer date", "settled on",
  ],
  amount: [
    "amount", "transaction amount", "paid amount", "value", "amt",
    "total amount", "payment amount",
  ],
  debit: [
    "debit", "debit amount", "withdrawal", "withdrawal amount",
    "paid", "spent", "dr amount", "dr",
  ],
  credit: [
    "credit", "credit amount", "deposit", "deposit amount",
    "received", "cr amount", "cr",
  ],
  type: [
    "type", "transaction type", "txn type", "dr/cr", "cr/dr",
    "nature", "mode", "txn mode",
  ],
  category: [
    "category", "transaction category", "merchant category", "purpose",
  ],
  description: [
    "description", "narration", "remarks", "remark", "details",
    "merchant", "payee", "note", "upi id", "name", "particulars",
    "beneficiary name", "sender name", "reference", "info",
    "transaction remarks", "payment remarks",
  ],
};

const getField = (row, aliases) => {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
};

// ─── AMOUNT CLEANER ───────────────────────────────────────────────────────────
const parseAmount = (value) => parseAmountValue(value);

// ─── CSV PARSING ──────────────────────────────────────────────────────────────
const parseCSVFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv({ mapHeaders: normalizeHeader }))
      .on("data", (rawRow) => {
        // Re-normalize keys after csv-parser
        const row = {};
        for (const [k, v] of Object.entries(rawRow)) {
          row[String(k).trim().toLowerCase()] = v;
        }

        // Skip completely empty rows
        const hasData = Object.values(row).some((v) => v && String(v).trim() !== "");
        if (!hasData) return;

        results.push(row);
      })
      .on("end", () => resolve(results))
      .on("error", reject);
  });
};

// ─── PDF SMART EXTRACTION (Legacy - now uses statementParser) ──────────────────
// Pattern sets for different bank formats (kept for backward compatibility)
const PDF_PATTERNS = [
  // PhonePe: "Mar 15, 2024 Paid to Swiggy ₹450.00"
  {
    name: "phonepe",
    pattern: /([A-Za-z]{3}\s+\d{1,2},\s+\d{4})[,\s]+(?:paid to|received from|from|to)\s+(.+?)\s+[₹Rs\.]+\s?([\d,]+(?:\.\d{1,2})?)/gi,
    extract: (m) => ({
      date: m[1],
      description: m[2].trim(),
      amount: m[3],
      type: m[0].toLowerCase().includes("paid to") ? "expense" : "income",
    }),
  },
  // Paytm: "15/03/2024 Swiggy 450.00 DR"
  {
    name: "paytm",
    pattern: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([\d,]+(?:\.\d{1,2})?)\s+(DR|CR|debit|credit)/gi,
    extract: (m) => ({
      date: m[1],
      description: m[2].trim(),
      amount: m[3],
      type: /dr|debit/i.test(m[4]) ? "expense" : "income",
    }),
  },
  // Standard bank: "15 Jan 2024  Swiggy Order  1,234.00  CR"
  {
    name: "standard_bank",
    pattern: /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s{2,}(.+?)\s{2,}([\d,]+(?:\.\d{1,2})?)\s+(CR|DR|credit|debit)/gi,
    extract: (m) => ({
      date: m[1],
      description: m[2].trim(),
      amount: m[3],
      type: /cr|credit/i.test(m[4]) ? "income" : "expense",
    }),
  },
  // HDFC / SBI: "01/01/2024  UPI-SWIGGY  1234.00"
  {
    name: "hdfc_sbi",
    pattern: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s{1,5}(UPI[\-\s].+?|NEFT.+?|RTGS.+?)\s{1,5}([\d,]+(?:\.\d{1,2})?)/gi,
    extract: (m) => ({
      date: m[1],
      description: m[2].trim(),
      amount: m[3],
      type: null, // will be inferred later
    }),
  },
  // Generic: line with date + amount pattern
  {
    name: "generic",
    pattern:
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|[A-Za-z]{3}\s+\d{1,2},\s*\d{4})\s+(.{3,60}?)\s+(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)\s*(CR|DR|credit|debit)?/gi,
    extract: (m) => ({
      date: m[1],
      description: (m[2] || "").trim(),
      amount: m[3],
      type: m[4] ? (/cr|credit/i.test(m[4]) ? "income" : "expense") : null,
    }),
  },
];

/**
 * Extract transactions from PDF text using multiple patterns.
 * Now delegates to statementParser for comprehensive extraction.
 */
const extractFromPDFText = (text) => {
  // Use the robust extraction from statementParser
  return extractTransactionsFromText(text);
};

/**
 * Parse a PDF bank statement using the robust pipeline.
 * Includes OCR fallback for scanned PDFs.
 */
const parsePDFFile = async (filePath) => {
  if (!pdfParse) {
    throw new Error("PDF support requires pdf-parse. Run: npm install pdf-parse");
  }

  const buffer = fs.readFileSync(filePath);

  // Use the robust statement processor
  const result = await processRobust(filePath, {
    originalname: path.basename(filePath),
    mimetype: "application/pdf",
  });

  return result.transactions;
};

// ─── DESCRIPTION CLEANER ──────────────────────────────────────────────────────
const cleanDescription = (desc) => {
  if (!desc) return "";
  return String(desc)
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

// ─── NORMALIZE A SINGLE ROW ───────────────────────────────────────────────────
/**
 * Normalize a raw row (from CSV or PDF) into a clean transaction object.
 * This is exported so uploadController can use it directly.
 */
const normalizeRow = (row, fallbackDate = new Date()) => {
  const rawDesc = String(getField(row, FIELD_ALIASES.description) || row.description || "").trim();
  let description = cleanDescription(rawDesc);

  if (description.length < 3) {
    description = rawDesc.trim(); // fallback if cleaning wiped everything
  }

  const rawCategory = getField(row, FIELD_ALIASES.category) || row.category || null;
  const rawType = getField(row, FIELD_ALIASES.type) || row.type || null;
  const rawDate = getField(row, FIELD_ALIASES.date) || row.date || null;

  const directAmountParsed = parseAmount(getField(row, FIELD_ALIASES.amount) || row.amount);
  const debitAmount = parseAmount(getField(row, FIELD_ALIASES.debit));
  const creditAmount = parseAmount(getField(row, FIELD_ALIASES.credit));

  let amountParsed = directAmountParsed;
  if (amountParsed === null) {
    if (debitAmount !== null) amountParsed = -Math.abs(debitAmount);
    else if (creditAmount !== null) amountParsed = Math.abs(creditAmount);
  }

  const amount = amountParsed !== null ? Math.abs(amountParsed) : null;
  const directIsNegative = amountParsed !== null ? amountParsed < 0 : false;
  const directIsPositive = amountParsed !== null ? amountParsed > 0 : false;

  const type = normalizeType(
    rawType,
    debitAmount,
    creditAmount,
    description,
    directIsNegative,
    directIsPositive
  );

  const date = parseDate(rawDate, fallbackDate);

  return {
    amount,
    type,
    description,
    date,
    rawCategory,
    debit: debitAmount,
    credit: creditAmount,
  };
};

// ─── TYPE NORMALIZER ──────────────────────────────────────────────────────────
const TYPE_INCOME_WORDS = /income|credit|cr|received|deposit|salary|refund|cashback|credited|bonus/i;
const TYPE_EXPENSE_WORDS = /expense|debit|dr|paid|purchase|upi|bill|withdrawal|debited|spent/i;
const TYPE_INVESTMENT_WORDS = /investment|sip|mutual fund|stock|etf|nps|ppf/i;

const normalizeType = (rawType, debitAmount, creditAmount, description, isNegative, isPositive) => {
  if (rawType) {
    const t = String(rawType).toLowerCase().trim();
    if (TYPE_INCOME_WORDS.test(t)) return "income";
    if (TYPE_EXPENSE_WORDS.test(t)) return "expense";
    if (TYPE_INVESTMENT_WORDS.test(t)) return "investment";
  }

  // Infer from explicit sign (amount < 0 -> expense)
  if (isNegative) return "expense";

  // Infer from debit/credit columns
  if (creditAmount !== null && debitAmount === null) return "income";
  if (debitAmount !== null && creditAmount === null) return "expense";

  // Infer from description
  if (description) {
    const d = description.toLowerCase();
    if (TYPE_INCOME_WORDS.test(d)) return "income";
    if (TYPE_INVESTMENT_WORDS.test(d)) return "investment";
    if (TYPE_EXPENSE_WORDS.test(d)) return "expense";
  }

  // If amount > 0 and no explicit descriptions of expense, default to positive inference
  if (isPositive && !isNegative) return "income";

  return null; // unknown — caller decides
};

// ─── MAIN ENTRY POINT ─────────────────────────────────────────────────────────
/**
 * Parse a bank statement file (CSV or PDF).
 * Returns array of raw rows for further normalization.
 *
 * @param {string} filePath
 * @param {{ originalname?: string, mimetype?: string }} fileMeta
 * @returns {Promise<Object[]>}
 */
const parseStatementFile = async (filePath, fileMeta = {}) => {
  const ext = path.extname(fileMeta.originalname || filePath).toLowerCase();
  const mime = String(fileMeta.mimetype || "").toLowerCase();

  console.log(`\n[Parser] parseStatementFile called for: ${fileMeta.originalname || filePath}`);

  if (ext === ".pdf" || mime.includes("pdf") || ext === ".csv" || mime.includes("csv")) {
    // Use the robust processor for all supported types
    const result = await processRobust(filePath, fileMeta);
    console.log(`[Parser] Robust processor returned ${result.transactions.length} transactions`);
    console.log(`[Parser] Metadata:`, JSON.stringify(result.metadata, null, 2));
    return result.transactions;
  }

  // Fallback for other file types
  return parseCSVFile(filePath);
};

module.exports = { parseStatementFile, normalizeRow, parseAmount, parseCSVFile, extractFromPDFText };

/**
 * financialNormalizer.js — Legacy compatibility shim.
 * All logic has been moved to:
 *   utils/categorizer.js   → category inference
 *   utils/dateNormalizer.js → date parsing
 *   utils/parser.js        → full row normalization
 *
 * This file re-exports the functions so any existing code
 * that imports from financialNormalizer.js continues to work.
 */

const { categorizeFast } = require("./categorizer");
const { parseDate } = require("./dateNormalizer");

// ─── Amount normalizer ──────────────────────────────────────────────────────
const normalizeAmount = (value) => {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[₹$€£\s,]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

// ─── Category normalizer ────────────────────────────────────────────────────
const normalizeCategory = (category) => {
  if (!category) return "other";
  let value = String(category).trim().toLowerCase();
  if (!value) return "other";
  value = value.replace(/[_\s]+/g, "-").replace(/-+/g, "-");

  // User-requested consolidations
  if (value === "investments" || value === "invenstment") value = "investment";
  if (value === "dining") value = "food";
  if (value === "transport") value = "travel";
  if (value === "emergency-fund") value = "emergency";
  if (value === "future-goals") value = "goals";
  if (value === "goals-fund") value = "goals";

  // Strip 50/30/20 budget prefix
  const segments = value.split("-").filter(Boolean);
  if (segments.length >= 2 && ["needs", "wants", "savings", "budget"].includes(segments[0])) {
    return segments.slice(1).join("-");
  }
  return value;
};

// ─── Type aliases ────────────────────────────────────────────────────────────
const BANK_TYPE_ALIASES = {
  income: ["income", "credit", "cr", "received", "deposit", "salary", "refund", "cashback"],
  expense: ["expense", "debit", "dr", "paid", "purchase", "upi", "bill", "withdrawal"],
  investment: ["investment", "sip", "mutual fund", "stock", "stocks", "etf", "nps", "ppf"],
  budget: ["budget", "allocation", "target"],
};

const normalizeType = (type, amount, description) => {
  if (type) {
    const t = String(type).toLowerCase().trim();
    const found = Object.entries(BANK_TYPE_ALIASES).find(([, aliases]) =>
      aliases.some((a) => t.includes(a))
    );
    if (found) return found[0];
  }

  if (description) {
    const d = String(description).toLowerCase();
    if (/(salary|credited|refund|received)/.test(d)) return "income";
    if (/(sip|mutual|stock|etf|investment|nps|ppf)/.test(d)) return "investment";
    if (/(debited|purchase|paid|bill|upi|transfer|rent)/.test(d)) return "expense";
  }

  return null;
};

// ─── Category inference (delegates to new categorizer) ──────────────────────
const inferCategoryFromDescription = (description, fallback = "other") => {
  const result = categorizeFast(description);
  return result || fallback;
};

module.exports = {
  normalizeCategory,
  normalizeType,
  normalizeAmount,
  inferCategoryFromDescription,
  parseDate,
};

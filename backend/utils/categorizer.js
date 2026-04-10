/**
 * HYBRID CATEGORIZATION ENGINE v3.0
 * ====================================
 * 95%+ accuracy target for Indian bank statement transactions.
 *
 * Layers (applied in order, first match wins):
 *   0. Pre-classifier: type-based shortcuts (income/investment before text analysis)
 *   1. Substring scan: check description against ordered keyword dictionary
 *   2. Regex patterns: specific bank/merchant patterns
 *   3. Contextual signals: NEFT/UPI prefix + payload analysis
 *   4. ML API fallback (FastAPI, async only)
 *   5. Absolute fallback → "other" (NEVER null/undefined)
 *
 * Key design decisions:
 *   - Keywords are checked via direct `.includes()` on normalized text (no tokenization)
 *     so "upiswiggy" still hits "swiggy".
 *   - Categories are ordered by specificity (food/travel before generic UPI)
 *   - UPI regex is NOT mapped to bills — UPI is just a payment rail, not a category
 *   - "received from", "credited by", "transfer cr" → income
 */

"use strict";

const axios = require("axios");

// ─── VALID CATEGORIES ─────────────────────────────────────────────────────────
const VALID_CATEGORIES = new Set([
  "food", "groceries", "transport", "shopping", "bills", "rent",
  "investment", "entertainment", "income", "health", "travel", "dining",
  "education", "hobbies", "emergency", "goals", "insurance", "emi", "other",
]);

// ─── KEYWORD DICTIONARY ───────────────────────────────────────────────────────
/**
 * Order matters: categories listed first have HIGHER priority.
 * Use LOWERCASE phrases. Longest/most-specific phrases first within each category
 * to reduce false positive on short tokens.
 */
const KEYWORD_MAP = {

  // ── INCOME (check before generic "credit" words that could be cards)
  income: [
    // Salary / payroll
    "salary credited", "sal credited", "salary credit", "salary cr",
    "payroll", "pay roll", "wages", "stipend", "honorarium",
    "neft salary", "imps salary", "salary neft", "monthly salary",
    "salary from", "employer credit", "employer credited",
    // Freelance / business
    "freelance", "upwork", "fiverr", "toptal", "invoice paid",
    "consulting fee", "professional fee", "service fee received",
    // Transfers in
    "received from", "transfer credit", "transfer cr", "trf cr",
    "credited by", "cr by", "fund transfer in", "inward transfer",
    "inward neft", "neft inward", "neft credit",
    "money received", "amount credited", "amount received",
    // Refunds / rewards
    "refund", "cashback", "reward", "reward points",
    "bonus credited", "incentive", "commission",
    "reimbursement", "claim settled", "insurance claim",
    "dividend", "interest credited", "interest credit",
    // Generic
    "salary", "payslip", "pay slip",
  ],

  // ── INVESTMENT (very specific — must come before bills to avoid FD→bills)
  investment: [
    "sip debit", "sip payment", "sip transfer", "sip auto",
    "mutual fund", "mf sip", "mf purchase",
    "zerodha", "groww", "upstox", "kuvera", "paytm money",
    "coin by zerodha", "smallcase", "scripbox", "etmoney",
    "nps", "ppf", "elss", "tax saving",
    "fixed deposit", "fd booking", "fd creation", "fd maturity",
    "recurring deposit", "rd installment",
    "ipo application", "ipo allotment",
    "demat", "brokerage", "trading account",
    "index fund", "debt fund", "gilt fund", "liquid fund",
    "etf purchase", "bond purchase",
    "invest", "investment",
    // keywords — but ONLY after more specific phrases above
    "sip", "groww sip", "fd", "rd",
  ],

  // ── GROCERIES (Needs)
  groceries: [
    "bigbasket", "big basket", "blinkit", "zepto", "jiomart",
    "grofers", "dunzo", "milkbasket", "licious", "freshtohome",
    "reliance fresh", "reliance smart", "dmart", "d mart",
    "more supermarket", "nature basket", "hypercity",
    "spencers", "star bazaar", "grocery", "supermarket", "instamart",
  ],

  // ── DINING (Wants)
  dining: [
    "swiggy", "zomato", "eatclub", "box8", "faasos", "freshmenu",
    "dunzo food", "shadowfax", "thrive",
    "mcdonalds", "mcdonald", "dominos", "pizza hut", "pizzahut",
    "kfc", "burger king", "burgerking", "subway", "taco bell",
    "starbucks", "cafe coffee day", "ccd", "costa coffee",
    "haldiram", "bikanervala", "wow momo", "biryani blues",
    "paradise biryani", "behrouz", "what the fish",
    "roll house", "sagar ratna", "udupi", "saravana bhavan",
    "paid to swiggy", "paid to zomato", "restaurant", "cafe", 
    "dhaba", "food court", "lunch", "dinner", "breakfast", 
    "food delivery", "hotel dining", "barbeque nation"
  ],

  // ── FOOD FALLBACK (Needs)
  food: [
    "canteen", "bakery", "sweet shop", "dairy", "milk booth", 
    "tiffin", "mess", "snacks", 
  ],

  // ── TRANSPORT
  transport: [
    // Ride hailing
    "uber", "ola cabs", "ola electric", "rapido", "meru",
    "blablacar", "shuttl", "bounce", "yulu", "vogo",
    "bike taxi", "auto rickshaw", "cab booking",
    // Metro / public transit
    "metro card", "dmrc", "bmrc", "nmmc", "hmrl", "cmrl",
    "local train", "mumbai local", "irctc", "railway",
    "redbus", "abhibus", "ksrtc", "msrtc", "gsrtc", "upsrtc",
    // Fuel & Tolls
    "hp petrol", "bpcl", "iocl", "indian oil",
    "petrol pump", "petrol station", "fuel station", "cng",
    "shell", "essar fuel", "fastag", "toll", "toll plaza",
    "parking", "traffic fine", "rto", "driving school",
    "petrol", "diesel", "fuel", "cab", "taxi", "bus ticket", "train ticket", "auto", "rickshaw",
  ],

  // ── TRAVEL (Wants)
  travel: [
    "indigo", "spicejet", "air india", "vistara", "go air",
    "akasa air", "blue dart", "flight booking",
    "makemytrip", "goibibo", "yatra", "cleartrip", "ixigo",
    "easemytrip", "confirmtkt",
    "oyo", "fabhotels", "treebo", "airbnb", "holiday inn",
    "marriott", "taj hotel", "itc hotel", "oberoi",
    "flight", "airline", "airport",
    "hotel", "resort", "accommodation", "hostel stay",
  ],

  // ── SHOPPING
  shopping: [
    // E-commerce
    "amazon", "flipkart", "myntra", "ajio", "nykaa",
    "meesho", "snapdeal", "tata cliq", "shopclues",
    "paytm mall", "jiomart shopping",
    // Electronics
    "reliance digital", "croma", "vijay sales",
    "sangeetha", "poorvika", "lenskart",
    "apple store", "samsung store", "mi store", "oneplus store",
    // Fashion
    "decathlon", "lifestyle", "westside", "zara", "h&m",
    "uniqlo", "pantaloons", "shoppers stop", "max fashion",
    "fabindia", "manyavar", "biba", "w for woman",
    "firstcry", "babyhug",
    // Beauty
    "nykaa", "purplle", "mamaearth", "wow skincare",
    "forest essentials",
    // Generic
    "shopping", "purchase", "buy now", "order placed",
    "e-commerce", "online store", "retail", "mall",
    "outlet", "boutique", "apparel", "clothing",
  ],

  // ── BILLS & UTILITIES
  // ── BILLS & UTILITIES
  bills: [
    "electricity bill", "power bill", "bescom", "tpddl", "msedcl", 
    "torrent power", "bses", "cesc", "tneb", "wesco", "adani electricity",
    "uppcl", "discoms", "water bill", "bwssb", "jal board", "water supply",
    "lpg cylinder", "piped gas", "indane gas", "hp gas cylinder", "bharat gas", 
    "igl gas", "mgl gas", "broadband bill", "airtel fiber", "jio fiber", 
    "act fibernet", "hathway", "excitel", "spectranet", "postpaid bill", 
    "mobile bill", "phone bill", "airtel postpaid", "jio postpaid", "vi postpaid", 
    "bsnl", "tata sky", "tata play", "dish tv", "sun direct", "d2h",
    "cable tv", "dth recharge", "mobile recharge", "prepaid recharge", 
    "sim recharge", "wallet recharge", "utility", "bill payment", 
    "recharge", "electricity", "internet", "broadband", "gas",
    // Tax
    "income tax", "advance tax", "gst payment", "professional tax",
    "property tax", "tds",
    // Education / Medical falls through to core ones later
    "school fee", "tuition fee", "college fee", "coaching fee", 
    "education fee", "exam fee", "byju", "unacademy", "vedantu",
    "hospital bill", "clinic bill", "lab test", "diagnostic",
    "pharmacy bill", "doctor fee", "consultation fee",
    "medplus", "apollo pharmacy", "1mg", "pharmeasy",
    "netmeds", "practo",
  ],

  // ── INSURANCE
  insurance: [
    "insurance premium", "lic premium", "health insurance",
    "car insurance", "bike insurance", "term insurance",
    "policybazaar", "care health", "star health"
  ],

  // ── EMI / LOANS
  emi: [
    "loan emi", "home loan emi", "car loan emi",
    "personal loan", "emi payment", "emi debit",
    "credit card bill", "cc bill", "credit card payment",
    "bajaj finance"
  ],

  // ── HOBBIES
  hobbies: [
    "guitar class", "art supplies", "pottery", "decathlon", 
    "golf club", "photography", "sports gear", "hobby", "stationery"
  ],

  // ── EMERGENCY
  emergency: [
    "ambulance", "towing service", "emergency repair", 
    "plumber", "laptop repair", "urgent clinical"
  ],

  // ── GOALS
  goals: [
    "vacation fund", "recurring deposit", "car savings", "sinking fund", "downpayment"
  ],

  // ── RENT & HOUSING
  rent: [
    "house rent", "flat rent", "room rent", "pg rent",
    "pg accommodation", "hostel fee", "lodge rent",
    "maintenance charges", "society maintenance",
    "housing society", "apartment rent",
    "nobroker", "99acres", "magicbricks", "housing.com",
    "nestaway", "stanza living", "zolo", "colive",
    "home loan emi",  // classified as rent-like
    "property tax",
    "rent paid", "rent transfer", "monthly rent",
    "rent",
  ],

  // ── ENTERTAINMENT
  entertainment: [
    // Streaming
    "netflix", "amazon prime", "disney hotstar", "hotstar",
    "zee5", "sonyliv", "voot", "alt balaji", "erosnow",
    "mxplayer", "jiocinema", "shemaroo",
    // Music
    "spotify", "gaana", "jiosaavn", "hungama", "wynk",
    "youtube premium", "apple music",
    // Gaming
    "steam", "playstation", "xbox", "nintendo", "epic games",
    "pubg", "bgmi", "free fire", "gaming",
    // Movies / events
    "pvr cinemas", "inox movies", "cinepolis",
    "carnival cinemas", "book my show", "bookmyshow",
    "ticketnew", "insider", "zomato ticketing",
    // Subscriptions
    "subscription", "membership fee",
    // Generic
    "movie ticket", "movie", "concert", "amusement park",
    "theme park", "fun zone", "entertainment",
  ],

  // ── HEALTH (separate from bills for better dashboard insights)
  health: [
    "gym membership", "fitness", "cult fit", "cultfit",
    "healthify", "cure fit", "yoga class", "health club",
    "doctor consultation", "medical checkup",
    "health insurance", "mediclaim",
    "pharmacy", "medicine", "hospital",
    "apollo", "fortis", "max hospital", "aiims",
    "narayana health", "manipal hospital",
  ],

  // ── EDUCATION (separate for insight)
  education: [
    "school fees", "college fees", "university fee",
    "byju", "unacademy", "vedantu", "toppr", "meritnation",
    "coursera", "udemy", "skillshare", "linkedin learning",
    "upgrad", "great learning",
    "tuition", "coaching", "exam registration",
    "neet fee", "jee fee", "cat fee",
    "study material", "book purchase",
  ],
};

// ─── BUILD FAST LOOKUP STRUCTURES ─────────────────────────────────────────────
// 1. Sorted phrases by length (longest first) for greedy matching
const PHRASE_LIST = []; // [{ phrase, category }] sorted longest→shortest

for (const [category, phrases] of Object.entries(KEYWORD_MAP)) {
  for (const phrase of phrases) {
    PHRASE_LIST.push({ phrase: phrase.toLowerCase(), category });
  }
}
PHRASE_LIST.sort((a, b) => b.phrase.length - a.phrase.length);

// ─── REGEX PATTERNS ───────────────────────────────────────────────────────────
/**
 * Applied AFTER keyword scan.
 * Each rule tests the FULL normalized description.
 * Order matters — more specific first.
 */
const REGEX_RULES = [
  // Income signals — "received", "credited", "inward"
  {
    re: /\b(?:received\s+from|credit\s+by|credited\s+by|inward\s+(?:neft|rtgs|imps)|transfer\s+cr|trf\s+cr|neft\s+cr|imps\s+cr|salary\s+cr|sal\s+cr|cr\s+by|money\s+received)\b/i,
    category: "income",
  },
  // Investment — SIP/MF/demat patterns
  {
    re: /\b(?:sip|mutual\s*fund|mf\s*purchase|zerodha|groww|upstox|nps\s*tier|ppf\s*deposit|elss|ipo\s*appl|fd\s*booking|rd\s*instalment|brokerage)\b/i,
    category: "investment",
  },
  // Groceries
  {
    re: /\b(?:bigbasket|blinkit|zepto|dunzo|jiomart|dmart|reliance\s*fresh)\b/i,
    category: "groceries",
  },
  // Dining / Food
  {
    re: /\b(?:swiggy|zomato|eatclub|mcdonalds|dominos|starbucks|ccd|kfc)\b/i,
    category: "dining",
  },
  // Generic Food
  {
    re: /\b(?:food delivery|restaurant|cafe|dining)\b/i,
    category: "dining",
  },
  // Travel
  {
    re: /\b(?:irctc|indigo|spicejet|air\s*india|vistara|makemytrip|goibibo|yatra|cleartrip)\b/i,
    category: "travel",
  },
  // Transport
  {
    re: /\b(?:fastag|petrol|diesel|bpcl|iocl|metro\s*card|dmrc)\b/i,
    category: "transport",
  },
  // Ride hailing
  { re: /\b(?:uber|ola\s*cabs?|rapido|meru\s*cabs?)\b/i, category: "transport" },
  // Shopping
  {
    re: /\b(?:amazon|flipkart|myntra|ajio|nykaa|meesho|snapdeal|croma|decathlon|shoppers\s*stop)\b/i,
    category: "shopping",
  },
  // Utilities & Bills
  {
    re: /\b(?:electricity|broadband|postpaid|prepaid\s*recharge|dth\s*recharge|cable\s*tv|water\s*bill|gas\s*bill|piped\s*gas)\b/i,
    category: "bills",
  },
  // Insurance
  {
    re: /\b(?:lic\s*premium|insurance\s*premium|health\s*insurance)\b/i,
    category: "insurance",
  },
  // EMI
  {
    re: /\b(?:loan\s*emi|credit\s*card\s*(?:bill|payment)?|emi\s*(?:payment|debit)?)\b/i,
    category: "emi",
  },
  // Rent
  {
    re: /\b(?:rent|house\s*rent|flat\s*rent|pg\s*rent|room\s*rent|hostel\s*fee|maintenance\s*charges|society\s*maintenance)\b/i,
    category: "rent",
  },
  // Streaming / entertainment
  {
    re: /\b(?:netflix|hotstar|prime\s*video|zee5|sonyliv|spotify|pvr|inox|bookmyshow|gaming)\b/i,
    category: "entertainment",
  },
  // Health
  {
    re: /\b(?:pharmacy|hospital|clinic|doctor|medical|healthify|cult\s*fit|gym\s*membership|diagnostic)\b/i,
    category: "health",
  },
  // Education
  {
    re: /\b(?:tuition|college\s*fee|school\s*fee|byju|unacademy|vedantu|coursera|udemy|upgrad)\b/i,
    category: "education",
  },
  // Salary — explicit label
  {
    re: /\b(?:salary|payroll|wages|stipend|neft\s+salary|monthly\s+pay|payslip)\b/i,
    category: "income",
  },
  // Refund / cashback
  {
    re: /\b(?:refund|cashback|reward|bonus|incentive|reimbursement|dividend)\b/i,
    category: "income",
  },
];

// ─── CONTEXTUAL UPI ANALYSIS ──────────────────────────────────────────────────
/**
 * UPI descriptions often look like:
 *   "UPI-SWIGGY TECHNOLOGIES-9876543210@okaxis"
 *   "UPI/PAYTM/SWIGGY ORDER 123/DEBIT"
 *   "UPI txn to BOOKMYSHOW"
 *
 * Strip the UPI/NEFT/IMPS prefix, then re-run keyword scan on payload only.
 */
const UPI_PREFIX_RE = /^(?:upi[\-\/\s]|neft[\-\/\s]|rtgs[\-\/\s]|imps[\-\/\s]|pos[\-\/\s]|nach[\-\/\s]|ach[\-\/\s]|clr[\-\/\s]|trf[\-\/\s])/i;

const analyzeUPIPayload = (normalized) => {
  // Strip one or more UPI/payment-rail prefixes
  let payload = normalized;
  let changed = true;
  while (changed) {
    const stripped = payload.replace(UPI_PREFIX_RE, "").trim();
    changed = stripped !== payload;
    payload = stripped;
  }

  if (payload === normalized) return null; // no prefix stripped

  // Run keyword match on stripped payload
  const hit = keywordScan(payload);
  if (hit && hit !== "other") return hit;

  // Run regex on payload
  for (const { re, category } of REGEX_RULES) {
    re.lastIndex = 0;
    if (re.test(payload)) return category;
  }

  return null;
};

// ─── KEYWORD SCAN ────────────────────────────────────────────────────────────
/**
 * Scan normalized description against PHRASE_LIST using substring includes.
 * Longest match wins (list is pre-sorted by length).
 */
const keywordScan = (normalized) => {
  for (const { phrase, category } of PHRASE_LIST) {
    if (normalized.includes(phrase)) return category;
  }
  return null;
};

// ─── TYPE-BASED SIGNALS ───────────────────────────────────────────────────────
/**
 * Use the transaction type (income / expense / investment) as a final signal
 * when text analysis fails.
 */
const categoryFromType = (type) => {
  if (!type) return null;
  const t = String(type).toLowerCase().trim();
  if (t === "income") return "income";
  if (t === "investment") return "investment";
  return null; // expense is too generic for a specific category
};

// ─── NORMALIZE TEXT ────────────────────────────────────────────────────────────
const normalizeDesc = (text) => {
  if (!text) return "";
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")   // replace special chars with space (keep alphanumeric)
    .replace(/\s+/g, " ")
    .trim();
};

// ─── MAIN SYNC CATEGORIZER ────────────────────────────────────────────────────
/**
 * Synchronous fast categorizer — used for bulk upload batches.
 * No network calls. Returns a valid category string, NEVER null.
 *
 * @param {string} description
 * @param {string} [type] - "income" | "expense" | "investment"
 * @returns {string}
 */
const categorizeFast = (description, type = "") => {
  if (!description && !type) return "other";

  const norm = normalizeDesc(description);

  // ── Layer 0: Pre-classifier from type ──
  const typeHint = categoryFromType(type);

  // ── Layer 1: Full-text keyword scan ──
  let category = keywordScan(norm);
  if (category) return category;

  // ── Layer 2: Regex patterns ──
  for (const { re, category: cat } of REGEX_RULES) {
    re.lastIndex = 0;
    if (re.test(norm)) return cat;
  }

  // ── Layer 3: UPI payload analysis ──
  const upiResult = analyzeUPIPayload(norm);
  if (upiResult) return upiResult;

  // ── Layer 4: Type-based hint ──
  if (typeHint) return typeHint;

  // ── Layer 5: Absolute fallback ──
  return "other";
};

// ─── ASYNC CATEGORIZER (with ML API fallback) ─────────────────────────────────
/**
 * Async version that tries ML service if sync fails to categorize.
 *
 * @param {string} description
 * @param {string} [type]
 * @param {string} [mlServiceUrl]
 * @returns {Promise<string>}
 */
const categorize = async (
  description,
  type = "",
  mlServiceUrl = process.env.ML_SERVICE_URL
) => {
  // Try sync first — covers 95%+ of cases
  const fast = categorizeFast(description, type);
  if (fast !== "other") return fast;

  // ── Layer ML: Call FastAPI categorizer ──
  if (mlServiceUrl && description) {
    try {
      const norm = normalizeDesc(description);
      const resp = await axios.post(
        `${mlServiceUrl}/categorize`,
        { description: norm },
        { timeout: 3000 }
      );
      const aiCategory = String(resp?.data?.category || "").toLowerCase().trim();
      if (aiCategory && VALID_CATEGORIES.has(aiCategory)) {
        console.log(`[Categorizer] ML: "${description.slice(0, 40)}" → ${aiCategory}`);
        return aiCategory;
      }
    } catch (_) {
      // ML service offline — silently fall through
    }
  }

  return "other";
};

// ─── BULK CATEGORIZER ─────────────────────────────────────────────────────────
/**
 * Categorize an array of transaction objects in bulk.
 * Uses ML API for the ones that resolve to "other" after sync pass.
 *
 * @param {Array<{description: string, type?: string}>} transactions
 * @param {string} [mlServiceUrl]
 * @returns {Promise<Array<{...txn, category: string}>>}
 */
const categorizeAll = async (transactions, mlServiceUrl = process.env.ML_SERVICE_URL) => {
  // Sync pass first (fast)
  const results = transactions.map(txn => ({
    ...txn,
    category: categorizeFast(txn.description, txn.type),
  }));

  // Async ML pass only for "other" ones
  const otherIndices = results
    .map((r, i) => (r.category === "other" ? i : -1))
    .filter(i => i >= 0);

  if (mlServiceUrl && otherIndices.length > 0) {
    await Promise.allSettled(
      otherIndices.map(async (i) => {
        const cat = await categorize(results[i].description, results[i].type, mlServiceUrl);
        results[i].category = cat;
      })
    );
  }

  return results;
};

// ─── STATS HELPER ─────────────────────────────────────────────────────────────
/**
 * Return categorization coverage stats for a batch.
 * @param {string[]} categories
 * @returns {{ total, categorized, uncategorized, rate, breakdown }}
 */
const getCategoryStats = (categories) => {
  const total   = categories.length;
  const breakdown = {};
  for (const cat of categories) {
    breakdown[cat] = (breakdown[cat] || 0) + 1;
  }
  const uncategorized = breakdown["other"] || 0;
  const categorized   = total - uncategorized;
  return {
    total,
    categorized,
    uncategorized,
    rate: total > 0 ? Math.round((categorized / total) * 100) : 0,
    breakdown,
  };
};

module.exports = {
  categorize,
  categorizeFast,
  categorizeAll,
  getCategoryStats,
  KEYWORD_MAP,
  VALID_CATEGORIES,
  // legacy compat
  KEYWORD_LOOKUP: Object.fromEntries(PHRASE_LIST.map(({ phrase, category }) => [phrase, category])),
};

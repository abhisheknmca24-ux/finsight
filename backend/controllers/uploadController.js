const fs = require("fs");
const { parseStatementFile, normalizeRow } = require("../utils/parser");
const { categorizeFast, getCategoryStats } = require("../utils/categorizer");
const { toYearMonth } = require("../utils/dateNormalizer");
const { normalizeCategory } = require("../utils/financialNormalizer");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const CategoryRule = require("../models/CategoryRule");

// ─── VALID TYPES ──────────────────────────────────────────────────────────────
const VALID_TYPES = ["income", "expense", "investment"];

// ─── CLEANUP UPLOADED FILE ────────────────────────────────────────────────────
const cleanupFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) { }
};

// ─── TYPE NORMALIZER ──────────────────────────────────────────────────────────
const resolveType = (rawType) => {
  if (!rawType) return null;
  const t = String(rawType).toLowerCase().trim();
  if (t === "income" || /cr|credit|received|deposit|salary|refund|cashback/i.test(t)) return "income";
  if (t === "expense" || /dr|debit|paid|purchase|withdrawal|spent/i.test(t)) return "expense";
  if (t === "investment" || /sip|mutual|stock|etf|nps|ppf|invest/i.test(t)) return "investment";
  return null;
};

// ─── DUPLICATE CHECK ──────────────────────────────────────────────────────────
/**
 * Check if a transaction with same amount + date (±1 day) + description already exists.
 */
const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const endOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const buildDuplicateSignature = (amount, date, description) => {
  const day = startOfDay(date).toISOString().slice(0, 10);
  const normalizedAmount = Number(amount || 0).toFixed(2);
  const normalizedDescription = String(description || "").trim();
  return `${day}|${normalizedAmount}|${normalizedDescription}`;
};

const getExistingDuplicateCount = async (
  userId,
  amount,
  date,
  description,
  duplicateCountCache
) => {
  const signature = buildDuplicateSignature(amount, date, description);

  if (!duplicateCountCache.has(signature)) {
    const count = await Transaction.countDocuments({
      userId,
      amount,
      description: description || "",
      date: { $gte: startOfDay(date), $lte: endOfDay(date) },
    });

    duplicateCountCache.set(signature, count);
  }

  return duplicateCountCache.get(signature);
};

// ─── POST /api/upload ─────────────────────────────────────────────────────────
exports.uploadCSV = async (req, res) => {
  const filePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Parse the uploaded file (CSV or PDF) with robust processor
    console.log(`\n[Upload] Processing file: ${req.file.originalname}`);
    console.log(`[Upload] File size: ${req.file.size} bytes, MIME: ${req.file.mimetype}`);

    const rawRows = await parseStatementFile(req.file.path, req.file);

    console.log(`[Upload] Extracted ${rawRows ? rawRows.length : 0} raw rows from file`);

    if (!rawRows || rawRows.length === 0) {
      cleanupFile(filePath);
      return res.status(400).json({
        error: "File is empty or contains no parseable transactions",
        hint: "Try uploading a clearer scan or a different file format",
      });
    }

    const uploadDate = new Date();
    const transactions = [];
    const budgetUpserts = [];
    const duplicates = [];
    const errors = [];
    let categorizedCount = 0;
    const duplicateCountCache = new Map();
    const processedSignatureCounts = new Map();

    const userRules = await CategoryRule.find({ userId: req.user.id });
    const ruleMap = userRules.map(r => ({ keyword: r.keyword.toLowerCase(), category: r.category }));

    for (let idx = 0; idx < rawRows.length; idx++) {
      try {
        const row = rawRows[idx];
        const normalized = normalizeRow(row, uploadDate);

        // ── Validate amount ──
        if (normalized.amount === null || isNaN(normalized.amount) || normalized.amount <= 0) {
          errors.push({
            row: idx + 2,
            reason: "Invalid or missing amount — must be a positive number",
          });
          continue;
        }

        // ── Resolve type ──
        // For PDF rows, the raw `type` field may carry "expense"/"income" already
        // from BANK_PATTERNS; honour it directly before falling back to resolveType.
        let type = null;
        const rawRowType = String(row.type || "").toLowerCase().trim();
        if (rawRowType === "income" || rawRowType === "expense" || rawRowType === "investment") {
          type = rawRowType;
        } else if (
          normalized.type === "income" ||
          normalized.type === "expense" ||
          normalized.type === "investment"
        ) {
          type = normalized.type;
        } else {
          type = resolveType(normalized.type || rawRowType);
        }
        if (!type) {
          // Last-resort: default to expense
          type = "expense";
        }

        // ── Handle budget rows ──
        if (String(normalized.rawCategory || "").toLowerCase() === "budget") {
          const category = categorizeFast(normalized.description) || "other";
          budgetUpserts.push({
            updateOne: {
              filter: { userId: req.user.id, category },
              update: { $set: { monthlyLimit: normalized.amount } },
              upsert: true,
            },
          });
          continue;
        }

        if (!VALID_TYPES.includes(type)) {
          errors.push({
            row: idx + 2,
            reason: `Invalid type "${type}". Must be income, expense, or investment`,
          });
          continue;
        }

        let category = String(normalized.rawCategory || "").toLowerCase().trim();
        if (!category || category === "other" || category === "") {
          const normDesc = normalized.description.toLowerCase();
          const matchedRule = ruleMap.find(r => normDesc.includes(r.keyword));
          if (matchedRule) {
            category = matchedRule.category;
            categorizedCount++;
          } else {
            category = categorizeFast(normalized.description, type);
            if (category && category !== "other") {
              categorizedCount++;
            }
          }
        } else {
          categorizedCount++;
        }
        
        category = normalizeCategory(category);

        const transactionDate = normalized.date;

        // ── Duplicate detection ──
        const signature = buildDuplicateSignature(
          normalized.amount,
          transactionDate,
          normalized.description
        );
        const existingDuplicateCount = await getExistingDuplicateCount(
          req.user.id,
          normalized.amount,
          transactionDate,
          normalized.description,
          duplicateCountCache
        );
        const processedCount = processedSignatureCounts.get(signature) || 0;
        processedSignatureCounts.set(signature, processedCount + 1);

        if (processedCount < existingDuplicateCount) {
          duplicates.push({
            row: idx + 2,
            amount: normalized.amount,
            date: transactionDate,
            description: normalized.description,
          });
          continue;
        }

        const uploadMonth = toYearMonth(transactionDate);

        transactions.push({
          userId: req.user.id,
          amount: normalized.amount,
          type,
          category,
          description: normalized.description,
          date: transactionDate,
          uploadMonth,
          uploadDate,
          source: row.source === "pdf" ? "pdf" : "csv",
        });
      } catch (rowErr) {
        errors.push({ row: idx + 2, reason: rowErr.message });
      }
    }

    // ── Bulk insert transactions ──
    let insertedCount = 0;
    if (transactions.length > 0) {
      const result = await Transaction.insertMany(transactions, { ordered: false });
      insertedCount = result.length;
    }

    // ── Bulk upsert budgets ──
    let budgetsUpdated = 0;
    if (budgetUpserts.length > 0) {
      const br = await Budget.bulkWrite(budgetUpserts, { ordered: false });
      budgetsUpdated = (br.upsertedCount || 0) + (br.modifiedCount || 0);
    }

    cleanupFile(filePath);

    // ── Category coverage stats ──
    const categoryStats = getCategoryStats(transactions.map(t => t.category));
    console.log(`\n[Upload] === PROCESSING COMPLETE ===`);
    console.log(`[Upload] Total rows: ${rawRows.length}`);
    console.log(`[Upload] Inserted: ${insertedCount}`);
    console.log(`[Upload] Duplicates skipped: ${duplicates.length}`);
    console.log(`[Upload] Errors: ${errors.length}`);
    console.log(`[Upload] Categorized: ${categoryStats.categorized}/${categoryStats.total} (${categoryStats.rate}%)`);
    console.log(`[Upload] Breakdown:`, JSON.stringify(categoryStats.breakdown, null, 2));

    res.json({
      message: "File processed successfully",
      stats: {
        totalRows: rawRows.length,
        inserted: insertedCount,
        categorized: categoryStats.categorized,
        categorizationRate: categoryStats.rate,
        categoryBreakdown: categoryStats.breakdown,
        duplicatesSkipped: duplicates.length,
        budgetsUpdated,
        failed: errors.length,
      },
      errors: errors.slice(0, 20),
      duplicates: duplicates.slice(0, 10),
      // Debug info for troubleshooting
      debug: {
        extractionSample: rawRows.slice(0, 5).map(r => ({
          date: r.date,
          amount: r.amount,
          description: (r.description || "").substring(0, 50),
          type: r.type,
          category: r.category,
          pattern: r.pattern || "csv",
        })),
      },
    });
  } catch (err) {
    cleanupFile(filePath);
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── DELETE /api/upload/reset ─────────────────────────────────────────────────
exports.resetAllTransactions = async (req, res) => {
  try {
    const result = await Transaction.deleteMany({
      userId: req.user.id,
      source: { $in: ["csv", "pdf"] },
    });

    let deletedBudgets = 0;
    const includeBudgets = String(req.query.includeBudgets || "false").toLowerCase() === "true";
    if (includeBudgets) {
      const budgetResult = await Budget.deleteMany({ userId: req.user.id });
      deletedBudgets = budgetResult.deletedCount || 0;
    }

    res.json({
      message: includeBudgets
        ? "Uploaded statement transactions and budgets deleted successfully"
        : "Uploaded statement transactions deleted successfully",
      deletedCount: result.deletedCount,
      deletedBudgets,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/upload/history ──────────────────────────────────────────────────
exports.getUploadHistory = async (req, res) => {
  try {
    const userId = new (require("mongoose").Types.ObjectId)(req.user.id);

    const uploadHistory = await Transaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$uploadMonth",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
          expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
          investment: { $sum: { $cond: [{ $eq: ["$type", "investment"] }, "$amount", 0] } },
          firstDate: { $min: "$uploadDate" },
          lastDate: { $max: "$uploadDate" },
        },
      },
      { $sort: { _id: -1 } },
      {
        $project: {
          _id: 0,
          month: "$_id",
          count: 1,
          totalAmount: { $round: ["$totalAmount", 2] },
          income: { $round: ["$income", 2] },
          expense: { $round: ["$expense", 2] },
          investment: { $round: ["$investment", 2] },
          firstDate: 1,
          lastDate: 1,
        },
      },
    ]);

    const overallStats = await Transaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalIncome: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
          totalExpense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
          totalInvestment: { $sum: { $cond: [{ $eq: ["$type", "investment"] }, "$amount", 0] } },
        },
      },
    ]);

    res.json({
      uploadHistory,
      overallStats: overallStats[0] || {
        totalTransactions: 0,
        totalIncome: 0,
        totalExpense: 0,
        totalInvestment: 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

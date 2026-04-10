const Transaction = require("../models/Transaction");
const { categorize } = require("../utils/categorizer");
const { parseDate, toYearMonth } = require("../utils/dateNormalizer");
const { normalizeCategory } = require("../utils/financialNormalizer");
const CategoryRule = require("../models/CategoryRule");
const {
  syncTransactionToFirestore,
  updateTransactionInFirestore,
  deleteTransactionFromFirestore,
} = require("../utils/firestoreSync");
const { invalidateDashboardCache } = require("../utils/dashboardCache");

// ─── POST /api/transactions ───────────────────────────────────────────────────
exports.addTransaction = async (req, res) => {
  try {
    let { amount, type, category, description, date } = req.body;

    // Validate required fields
    if (amount === undefined || amount === null || amount === "") {
      return res.status(400).json({ message: "amount is required" });
    }
    if (!type) {
      return res.status(400).json({ message: "type is required (income | expense | investment)" });
    }

    amount = Number(amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "amount must be a positive number greater than 0" });
    }

    type = String(type).toLowerCase().trim();
    if (!["income", "expense", "investment"].includes(type)) {
      return res.status(400).json({
        message: "type must be one of: income, expense, investment",
      });
    }

    // Auto-categorize if category is empty
    category = String(category || "").trim();
    if (!category && description) {
      const userRules = await CategoryRule.find({ userId: req.user.id });
      const normDesc = description.toLowerCase();
      const matchedRule = userRules.find(r => normDesc.includes(r.keyword.toLowerCase()));
      if (matchedRule) {
        category = matchedRule.category;
      } else {
        category = await categorize(description);
      }
    }
    if (!category) category = "other";
    category = normalizeCategory(category);

    // Normalize date
    const parsedDate = parseDate(date || null, new Date());

    const transaction = await Transaction.create({
      userId: req.user.id,
      amount,
      type,
      category,
      description: String(description || "").trim(),
      date: parsedDate,
      uploadMonth: toYearMonth(parsedDate),
      source: "manual",
    });

    // Fire-and-forget Firestore sync (never blocks response)
    syncTransactionToFirestore(transaction);
    invalidateDashboardCache(req.user.id);

    res.status(201).json(transaction);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/transactions ────────────────────────────────────────────────────
exports.getTransactions = async (req, res) => {
  try {
    const {
      type,
      category,
      from,
      to,
      page = 1,
      limit = 50,
      sort = "date",
      order = "desc",
    } = req.query;

    const filter = { userId: req.user.id };

    if (type) filter.type = type.toLowerCase();
    if (category) filter.category = category.toLowerCase();
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortDir = order === "asc" ? 1 : -1;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ [sort]: sortDir })
        .skip(skip)
        .limit(Number(limit)),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      transactions,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── PUT /api/transactions/:id ────────────────────────────────────────────────
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, type, category, description, date } = req.body;

    const transaction = await Transaction.findOne({ _id: id, userId: req.user.id });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "amount must be a positive number" });
      }
      transaction.amount = parsedAmount;
    }

    if (type !== undefined) {
      const t = String(type).toLowerCase().trim();
      if (!["income", "expense", "investment"].includes(t)) {
        return res.status(400).json({ message: "type must be income, expense, or investment" });
      }
      transaction.type = t;
    }

    if (category !== undefined) transaction.category = normalizeCategory(category);
    if (description !== undefined) transaction.description = String(description).trim();
    if (date !== undefined) {
      const parsedDate = parseDate(date, transaction.date);
      transaction.date = parsedDate;
      transaction.uploadMonth = toYearMonth(parsedDate);
    }

    await transaction.save();

    // Fire-and-forget Firestore sync
    updateTransactionInFirestore(transaction);
    invalidateDashboardCache(req.user.id);

    res.json(transaction);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

// ─── DELETE /api/transactions/:id ─────────────────────────────────────────────
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Fire-and-forget Firestore delete
    deleteTransactionFromFirestore(req.user.id, id);
    invalidateDashboardCache(req.user.id);

    res.json({ message: "Transaction deleted successfully", id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/transactions/rules ─────────────────────────────────────────────
exports.addCategoryRule = async (req, res) => {
  try {
    let { keyword, category } = req.body;
    if (!keyword || !category) {
      return res.status(400).json({ message: "Keyword and category are required" });
    }

    keyword = String(keyword).trim().toLowerCase();
    category = normalizeCategory(String(category).trim().toLowerCase());

    // Create or update the rule
    await CategoryRule.findOneAndUpdate(
      { userId: req.user.id, keyword },
      { category },
      { upsert: true, new: true }
    );

    // Retroactively update existing transactions matching this keyword
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const result = await Transaction.updateMany(
      { userId: req.user.id, description: { $regex: regex } },
      { $set: { category } }
    );

    res.json({ 
      message: "Rule added successfully", 
      transactionsUpdated: result.modifiedCount 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
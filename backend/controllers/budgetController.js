const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");
const { normalizeCategory } = require("../utils/financialNormalizer");

exports.setBudget = async (req, res) => {
  try {
    const { category, monthlyLimit } = req.body;
    const normalizedCategory = normalizeCategory(category);
    const parsedLimit = Number(monthlyLimit);

    if (!normalizedCategory || Number.isNaN(parsedLimit) || parsedLimit <= 0) {
      return res.status(400).json({ error: "Valid category and monthlyLimit are required" });
    }

    const budget = await Budget.findOneAndUpdate(
      {
        userId: req.user.id,
        category: normalizedCategory,
      },
      {
        $set: {
          monthlyLimit: parsedLimit,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    // Clean accidental historical duplicates for this user/category and keep latest budget.
    await Budget.deleteMany({
      userId: req.user.id,
      category: normalizedCategory,
      _id: { $ne: budget._id },
    });

    res.json(budget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBudgetStatus = async (req, res) => {
  try {
    const budgets = await Budget.find({ userId: req.user.id }).lean();
    const budgetByCategory = new Map();

    budgets.forEach((budget) => {
      const category = normalizeCategory(budget.category);
      const existing = budgetByCategory.get(category);
      if (!existing || budget.monthlyLimit > existing.monthlyLimit) {
        budgetByCategory.set(category, {
          category,
          monthlyLimit: Number(budget.monthlyLimit) || 0,
          userId: budget.userId,
        });
      }
    });

    const result = [];
    
    // Calculate start and end of current month
    const now = new Date();
    let startOfMonth, endOfMonth;
    if (req.query.month) {
      const parts = req.query.month.split("-");
      startOfMonth = new Date(parts[0], parts[1] - 1, 1);
      endOfMonth = new Date(parts[0], parts[1], 0, 23, 59, 59, 999);
    } else {
      startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    if (budgetByCategory.size === 0) {
      const userObjectId = new mongoose.Types.ObjectId(req.user.id);
      const unbudgeted = await Transaction.aggregate([
        {
          $match: {
            userId: userObjectId,
            date: { $gte: startOfMonth, $lte: endOfMonth },
            type: { $in: ["expense", "investment"] },
          },
        },
        {
          $group: {
            _id: { $toLower: { $trim: { input: "$category" } } },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { total: -1 } },
      ]);

      const fallback = unbudgeted
        .filter((row) => row._id)
        .map((row) => ({
          category: normalizeCategory(row._id),
          limit: 0,
          spent: Number(row.total) || 0,
          remaining: -(Number(row.total) || 0),
          isUnbudgeted: true,
        }));

      return res.json(fallback);
    }

    for (const b of budgetByCategory.values()) {
      const spent = await Transaction.aggregate([
        {
          $match: {
            userId: b.userId,
            date: { $gte: startOfMonth, $lte: endOfMonth },
            type: { $in: ["expense", "investment"] }, // Count both towards budgets
            category: { $regex: `^${b.category}$`, $options: "i" }, // Case-insensitive match
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const totalSpent = spent[0]?.total || 0;

      result.push({
        category: b.category,
        limit: b.monthlyLimit,
        spent: totalSpent,
        remaining: b.monthlyLimit - totalSpent,
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update budget
exports.updateBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, monthlyLimit } = req.body;

    const budget = await Budget.findOne({ _id: id, userId: req.user.id });

    if (!budget) {
      return res.status(404).json({ message: "Budget not found" });
    }

    if (category) budget.category = normalizeCategory(category);
    if (monthlyLimit !== undefined) budget.monthlyLimit = Number(monthlyLimit);

    await budget.save();
    res.json(budget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete budget
exports.deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;

    const budget = await Budget.findOneAndDelete({ _id: id, userId: req.user.id });

    if (!budget) {
      return res.status(404).json({ message: "Budget not found" });
    }

    res.json({ message: "Budget deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
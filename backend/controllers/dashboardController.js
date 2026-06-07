const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");
const axios = require("axios");
const { getDashboardCache, setDashboardCache } = require("../utils/dashboardCache");

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const formatMonthLabel = (year, month) => {
  const index = Number(month) - 1;
  if (index < 0 || index > 11) return `${year}-${String(month).padStart(2, "0")}`;
  return `${MONTH_NAMES[index]} ${year}`;
};

// ─── GET /api/dashboard ───────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const cachedPayload = getDashboardCache(req.user.id);
    if (cachedPayload) {
      return res.json(cachedPayload);
    }

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const [typeTotals, categoryAgg, monthlyTrendAgg, recentTransactions, incomeSourcesAgg, monthlyExpenseSeriesAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { userId, type: "expense" } },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
            avgAmount: { $avg: "$amount" },
          },
        },
        { $sort: { total: -1 } },
      ]),
      Transaction.aggregate([
        {
          $match: {
            userId,
            date: { $gte: twelveMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
            },
            income: {
              $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
            },
            expense: {
              $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
            },
            investment: {
              $sum: { $cond: [{ $eq: ["$type", "investment"] }, "$amount", 0] },
            },
            transactionCount: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      Transaction.find({ userId })
        .sort({ date: -1 })
        .limit(10)
        .select("amount type category description date")
        .lean(),
      Transaction.aggregate([
        { $match: { userId, type: "income" } },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
      Transaction.aggregate([
        { $match: { userId, type: "expense" } },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
            },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    let totalIncome = 0;
    let totalExpense = 0;
    let totalInvestment = 0;

    typeTotals.forEach(({ _id, total }) => {
      if (_id === "income") totalIncome = total;
      else if (_id === "expense") totalExpense = total;
      else if (_id === "investment") totalInvestment = total;
    });

    const savings = totalIncome - totalExpense - totalInvestment;
    const savingsRate = totalIncome > 0 ? ((savings / totalIncome) * 100).toFixed(1) : "0.0";

    const categoryBreakdown = categoryAgg.map((row) => {
      const roundedTotal = Math.round(Number(row.total || 0) * 100) / 100;
      return {
        category: row._id,
        total: roundedTotal,
        count: row.count || 0,
        avgAmount: Math.round(Number(row.avgAmount || 0) * 100) / 100,
        percentage: totalExpense > 0 ? Math.round((roundedTotal / totalExpense) * 1000) / 10 : 0,
      };
    });

    const monthlyTrend = monthlyTrendAgg.map((row) => {
      const year = row._id.year;
      const month = row._id.month;
      const income = Math.round(Number(row.income || 0) * 100) / 100;
      const expense = Math.round(Number(row.expense || 0) * 100) / 100;
      const investment = Math.round(Number(row.investment || 0) * 100) / 100;
      return {
        month: formatMonthLabel(year, month),
        income,
        expense,
        investment,
        savings: Math.round((income - expense) * 100) / 100,
        transactionCount: row.transactionCount || 0,
      };
    });

    // ── 4. Top 5 spending categories ──
    const topCategories = categoryBreakdown.slice(0, 5);

    const incomeSources = incomeSourcesAgg.map((row) => ({
      category: row._id,
      total: Math.round(Number(row.total || 0) * 100) / 100,
      count: row.count || 0,
    }));

    const monthlyExpenseValues = monthlyExpenseSeriesAgg.map((row) => Math.round(Number(row.total || 0) * 100) / 100);
    let aiForecast = {
      nextMonthExpense: 0,
      confidence: "low",
      model: "fallback",
      monthsUsed: monthlyExpenseValues.length,
    };

    if (monthlyExpenseValues.length > 0) {
      try {
        const predictionRes = await axios.post(`${process.env.ML_SERVICE_URL}/predict`, {
          values: monthlyExpenseValues,
        }, { timeout: 1200 });

        aiForecast = {
          nextMonthExpense: Number(predictionRes.data.prediction || 0),
          confidence: predictionRes.data.confidence || "medium",
          model: predictionRes.data.model || "ensemble_lr_rf",
          monthsUsed: monthlyExpenseValues.length,
        };
      } catch (error) {
        const avg = monthlyExpenseValues.reduce((sum, val) => sum + val, 0) / monthlyExpenseValues.length;
        aiForecast.nextMonthExpense = Number(avg.toFixed(2));
      }
    }

    const payload = {
      summary: {
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpense: Math.round(totalExpense * 100) / 100,
        totalInvestment: Math.round(totalInvestment * 100) / 100,
        savings: Math.round(savings * 100) / 100,
        savingsRate: Number(savingsRate),
      },
      aiForecast,
      categoryBreakdown,
      topCategories,
      monthlyTrend,
      incomeSources,
      recentTransactions,
    };

    setDashboardCache(req.user.id, payload);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
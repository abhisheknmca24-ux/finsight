const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");
const axios = require("axios");
const { getExpenseSeriesValues } = require("../utils/expenseSeries");

// ─── GET /api/dashboard ───────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    // ── 1. Income / Expense / Investment / Savings totals ──
    const typeTotals = await Transaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
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

    // ── 2. Category-wise aggregation (expense only) ──
    const categoryBreakdown = await Transaction.aggregate([
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
      {
        $project: {
          _id: 0,
          category: "$_id",
          total: { $round: ["$total", 2] },
          count: 1,
          avgAmount: { $round: ["$avgAmount", 2] },
          percentage: {
            $cond: {
              if: { $gt: [totalExpense, 0] },
              then: {
                $round: [{ $multiply: [{ $divide: ["$total", totalExpense] }, 100] }, 1],
              },
              else: 0,
            },
          },
        },
      },
    ]);

    // ── 3. Monthly trend (last 12 months) ──
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyTrend = await Transaction.aggregate([
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
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              {
                $cond: {
                  if: { $lt: ["$_id.month", 10] },
                  then: { $concat: ["0", { $toString: "$_id.month" }] },
                  else: { $toString: "$_id.month" },
                },
              },
            ],
          },
          income: { $round: ["$income", 2] },
          expense: { $round: ["$expense", 2] },
          investment: { $round: ["$investment", 2] },
          savings: { $round: [{ $subtract: ["$income", "$expense"] }, 2] },
          transactionCount: 1,
        },
      },
      { $sort: { month: 1 } },
    ]);

    // ── 4. Top 5 spending categories ──
    const topCategories = categoryBreakdown.slice(0, 5);

    // ── 5. Recent transactions (last 10) ──
    const recentTransactions = await Transaction.find({ userId })
      .sort({ date: -1 })
      .limit(10)
      .select("amount type category description date");

    // ── 6. Income sources breakdown ──
    const incomeSources = await Transaction.aggregate([
      { $match: { userId, type: "income" } },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      {
        $project: {
          _id: 0,
          category: "$_id",
          total: { $round: ["$total", 2] },
          count: 1,
        },
      },
    ]);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const formattedMonthlyTrend = monthlyTrend.map((m) => {
      const parts = m.month.split("-");
      const y = parts[0];
      const mo = parseInt(parts[1], 10) - 1;
      return {
        ...m,
        month: `${monthNames[mo]} ${y}`, // e.g., "March 2024"
      };
    });

    const allTransactions = await Transaction.find({ userId }).select("amount type date");
    const { values: monthlyExpenseValues } = getExpenseSeriesValues(allTransactions);
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
        });

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

    res.json({
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
      monthlyTrend: formattedMonthlyTrend,
      incomeSources,
      recentTransactions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
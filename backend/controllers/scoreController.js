const Transaction = require("../models/Transaction");
const axios = require("axios");
const { getExpenseSeriesValues } = require("../utils/expenseSeries");

exports.getScore = async (req, res) => {
  try {
    const userId = req.user.id;
    const allTransactions = await Transaction.find({ userId });

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const currentMonthTx = allTransactions.filter(t => {
      const d = new Date(t.date);
      return d >= thirtyDaysAgo && d <= now;
    });

    let income = 0;
    let expense = 0;
    let investment = 0;
    let unnecessaryExpense = 0;

    // Anomalies
    const expensesList = [];
    const anomalies = [];

    currentMonthTx.forEach((t) => {
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") {
        expense += t.amount;
        expensesList.push(t);
        // Treat shopping and entertainment as "unnecessary" for spending control metric
        if (["shopping", "entertainment"].includes(t.category)) {
          unnecessaryExpense += t.amount;
        }
      } else if (t.type === "investment") {
        investment += t.amount;
      }
    });

    // ─── 1. Savings Ratio (40 points) ───
    const savings = income - expense;
    const savingsRatio = income > 0 ? (savings / income) * 100 : 0;
    
    let savingsScore = 0;
    if (savingsRatio >= 20) savingsScore = 40;
    else if (savingsRatio >= 10) savingsScore = 30;
    else if (savingsRatio > 0) savingsScore = 15;
    else savingsScore = 0;

    // ─── 2. Spending Control (30 points) ───
    // Lower unnecessary expenses -> higher score
    const unnecessaryRatio = expense > 0 ? (unnecessaryExpense / expense) * 100 : 0;
    
    let spendingScore = 0;
    if (unnecessaryRatio <= 10) spendingScore = 30;
    else if (unnecessaryRatio <= 20) spendingScore = 20;
    else if (unnecessaryRatio <= 30) spendingScore = 10;
    else spendingScore = 0;

    // ─── 3. Investment Ratio (30 points) ───
    const investmentRatio = income > 0 ? (investment / income) * 100 : 0;
    
    let investmentScore = 0;
    if (investmentRatio >= 15) investmentScore = 30;
    else if (investmentRatio >= 10) investmentScore = 20;
    else if (investmentRatio > 0) investmentScore = 10;
    else investmentScore = 0;

    // ─── FINAL SCORE ───
    const totalScore = savingsScore + spendingScore + investmentScore;

    let status = "Poor";
    let statusColor = "red";
    if (totalScore >= 70) {
      status = "Good";
      statusColor = "green";
    } else if (totalScore >= 40) {
      status = "Average";
      statusColor = "yellow";
    }

    // ─── ANOMALY DETECTION ───
    // Detect sudden high expense spikes (abnormal spending compared to average)
    if (expensesList.length > 5) {
      const avgExpense = expense / expensesList.length;
      // Define a spike as an expense > 3x the average transaction size AND > 1000
      expensesList.forEach((t) => {
        if (t.amount > avgExpense * 3 && t.amount > 1000) {
          const dateStr = t.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          anomalies.push(`Unusual high spending of ₹${t.amount} detected on ${dateStr} for ${t.category}.`);
        }
      });
    }

    // ─── Get ML Predictions ───
    const { series: monthlyExpenseSeries, values: monthlyExpenseValues } = getExpenseSeriesValues(allTransactions);
    let predictedExpense = 0;
    let avgMonthlyExpense = monthlyExpenseValues.length > 0
      ? monthlyExpenseValues.reduce((sum, val) => sum + val, 0) / monthlyExpenseValues.length
      : 0;
    try {
      const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/predict`, {
        values: monthlyExpenseValues,
      });
      predictedExpense = Number(mlRes.data.prediction || 0);
    } catch (err) {
      // ML service error - use average as fallback
      predictedExpense = avgMonthlyExpense;
    }

    res.json({
      healthScore: Math.round(totalScore),
      status,
      statusColor,
      income,
      expense,
      savings,
      savingsRatio: parseFloat(savingsRatio.toFixed(1)),
      expenseRatio: parseFloat((income > 0 ? (expense / income) * 100 : 0).toFixed(1)),
      investmentRatio: parseFloat(investmentRatio.toFixed(1)),
      anomalies: anomalies.slice(0, 5), // Top 5 anomalies
      predictedExpense: Math.round(predictedExpense),
      avgMonthlyExpense: Math.round(avgMonthlyExpense),
      predictionBasis: "monthly_expense_time_series",
      historyMonthsUsed: monthlyExpenseSeries.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
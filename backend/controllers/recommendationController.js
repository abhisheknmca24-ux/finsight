const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");

exports.getRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const [allTransactions, budgets] = await Promise.all([
      Transaction.find({ userId }).lean(),
      Budget.find({ userId }).lean(),
    ]);

    // 1. Extract Current Month Window for exact ratios and budgeting
    const currentTx = [];
    allTransactions.forEach(t => {
      const d = new Date(t.date);
      if (d >= thirtyDaysAgo && d <= now) {
        currentTx.push(t);
      }
    });

    let income = 0;
    let expense = 0;
    let investment = 0;
    const categoryExpenses = {};

    currentTx.forEach((t) => {
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") {
        expense += t.amount;
        categoryExpenses[t.category] = (categoryExpenses[t.category] || 0) + t.amount;
      } else if (t.type === "investment") {
        investment += t.amount;
      }
    });

    const savings = income - expense - investment;
    const savingsRatio = income > 0 ? (savings / income) * 100 : 0;
    const expenseRatio = income > 0 ? (expense / income) * 100 : 0;
    const investRatio = income > 0 ? (investment / income) * 100 : 0;
    
    // Calculate category percentages
    const getCatPct = (cat) => expense > 0 ? ((categoryExpenses[cat] || 0) / expense) * 100 : 0;
    
    const recommendations = [];
    const categoryIssues = [];

    // ─── 1. MONTHLY TREND ANALYSIS ───
    const monthlyData = {};
    allTransactions.forEach(t => {
      const gMonth = new Date(t.date).toLocaleString("default", { month: "short", year: "numeric" });
      if (!monthlyData[gMonth]) {
        monthlyData[gMonth] = { income: 0, expense: 0, timestamp: new Date(t.date).getTime() };
      }
      if (t.type === "income") monthlyData[gMonth].income += t.amount;
      else if (t.type === "expense") monthlyData[gMonth].expense += t.amount;
    });

    const sortedMonths = Object.keys(monthlyData).sort((a, b) => monthlyData[a].timestamp - monthlyData[b].timestamp);
    if (sortedMonths.length >= 2) {
      const last = monthlyData[sortedMonths[sortedMonths.length - 1]];
      const prev = monthlyData[sortedMonths[sortedMonths.length - 2]];
      
      if (last.expense > prev.expense * 1.05) { // 5% increase in spending
        const diff = last.expense - prev.expense;
        recommendations.push({
          priority: "high",
          icon: "📈",
          title: "Spending Trend Alert",
          description: `Your expenses have increased by ₹${diff.toLocaleString("en-IN")} compared to last month. Monitor your discretionary spending.`,
          actions: [
            "Review your transaction history for large one-off purchases",
            "Stick strictly to your defined budgets for the next few weeks"
          ],
        });
      }
    }

    // ─── 2. ABSOLUTE THRESHOLDS ───
    const foodSpent = categoryExpenses["food"] || 0;
    if (foodSpent > 5000) {
      recommendations.push({
        priority: "high",
        icon: "🍔",
        title: "High Food Spending",
        description: `Frequent food orders detected. You spent ₹${foodSpent.toLocaleString("en-IN")} this month, exceeding absolute optimal thresholds.`,
        actions: [
          "Cook more meals at home",
          "Set a strict weekly budget for ordering in"
        ],
      });
    }

    const shopSpent = categoryExpenses["shopping"] || 0;
    if (shopSpent > 5000) {
      recommendations.push({
        priority: "high",
        icon: "🛍️",
        title: "Lifestyle Creep Detected",
        description: `Shopping expenses are high (₹${shopSpent.toLocaleString("en-IN")}). Avoid unnecessary lifestyle inflation to protect savings.`,
        actions: [
          "Use the 24-hour rule before buying non-essentials",
          "Unsubscribe from e-commerce promotional emails"
        ],
      });
    }

    // ─── 3. DYNAMIC CATEGORY TRIGGER ───
    const essentials = ["rent", "emi", "utilities", "bills", "groceries", "health", "insurance", "education"];
    for (const [cat, amt] of Object.entries(categoryExpenses)) {
      if (!essentials.includes(cat) && !["food", "shopping", "transport"].includes(cat)) {
        if (getCatPct(cat) > 20) {
          recommendations.push({
            priority: "medium",
            icon: "🚨",
            title: `Unusual ${cat} Spending`,
            description: `${cat.charAt(0).toUpperCase() + cat.slice(1)} took up ${getCatPct(cat).toFixed(1)}% of your expenses (₹${amt.toLocaleString("en-IN")}).`,
            actions: [`Review your ${cat} transactions`, `Create a rigid budget specific to ${cat}`]
          });
        }
      }
    }

    // ─── 4. STANDARD RATIOS ───
    if (savingsRatio < 20) {
      const targetSavings = income * 0.20;
      const gap = targetSavings - savings;
      recommendations.push({
        priority: savingsRatio < 10 ? "critical" : "high",
        icon: "💰",
        title: "Increase savings ratio to 20%",
        description: `Your current savings ratio is low (${savingsRatio.toFixed(1)}%). Try to save an additional ₹${gap > 0 ? gap.toLocaleString("en-IN") : "amount"}.`,
        actions: ["Automate your savings transfer on payday", "Cut down on discretionary shopping"]
      });
    }

    if (investment === 0 && income > 0) {
      recommendations.push({
        priority: "high",
        icon: "📉",
        title: "Not enough investments",
        description: "You have 0% invested. Inflation destroys idle cash. Start investing to build long-term wealth.",
        actions: ["Start a small SIP in an Index Mutual Fund"]
      });
    }

    const transportPct = getCatPct("transport");
    if (transportPct > 15) {
      recommendations.push({
        priority: "medium",
        icon: "🚗",
        title: "Optimize transportation",
        description: `Transport takes up ${transportPct.toFixed(1)}% of your monthly expenses.`,
        actions: ["Use public transport (metro/bus) instead of cabs", "Carpool for daily office commutes"]
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: "low",
        icon: "🌟",
        title: "Excellent Financial Health",
        description: "Your spending, savings, and investments are perfectly balanced according to the 50/30/20 rule. Keep going!",
        actions: ["Review your portfolio asset allocation"]
      });
    }

    // Analyze Budget Issues
    budgets.forEach((b) => {
      const spent = categoryExpenses[b.category] || 0;
      const pct = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
      if (pct > 100) {
        categoryIssues.push({
          category: b.category,
          percentage: pct,
          status: pct > 120 ? "severely_exceeded" : "exceeded"
        });
      }
    });

    const topSpenders = Object.entries(categoryExpenses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    res.json({
      recommendations,
      analysis: {
        lowSavings: savingsRatio < 20,
        highExpenses: expenseRatio > 70,
        overspending: savings < 0,
        categoryIssues,
      },
      summary: {
        totalTransactions: currentTx.length,
        income: Number(income.toFixed(2)),
        expense: Number(expense.toFixed(2)),
        investment: Number(investment.toFixed(2)),
        netSavings: Number(savings.toFixed(2)),
        savingsRatio: Number(savingsRatio.toFixed(2)),
        expenseRatio: Number(expenseRatio.toFixed(2)),
        investmentRatio: Number(investRatio.toFixed(2)),
        topSpenders,
        budgetCount: budgets.length,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
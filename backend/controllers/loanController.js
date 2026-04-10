const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");

exports.calculateLoan = async (req, res) => {
  try {
    const { loanAmount, interestRate, tenureMonths } = req.body;
    
    if (!loanAmount || !interestRate || !tenureMonths) {
      return res.status(400).json({ error: "Please provide loanAmount, interestRate, and tenureMonths" });
    }

    // 1. Calculate EMI
    const P = Number(loanAmount);
    const r = Number(interestRate) / 12 / 100;
    const n = Number(tenureMonths);

    let emi = 0;
    if (r === 0) {
      emi = P / n;
    } else {
      emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }
    emi = Math.round(emi * 100) / 100;

    // 2. Generate repayment schedule
    const repaymentSchedule = [];
    let remainingBalance = P;

    for (let month = 1; month <= n; month++) {
      const interestPaid = remainingBalance * r;
      let principalPaid = emi - interestPaid;

      // Handle last month rounding issues
      if (month === n) {
        principalPaid = remainingBalance;
        emi = principalPaid + interestPaid;
      }

      remainingBalance -= principalPaid;
      if (remainingBalance < 0) remainingBalance = 0;

      repaymentSchedule.push({
        month,
        emi: Math.round(emi * 100) / 100,
        principalPaid: Math.round(principalPaid * 100) / 100,
        interestPaid: Math.round(interestPaid * 100) / 100,
        remainingBalance: Math.round(remainingBalance * 100) / 100,
      });
    }

    // 3. Fetch user financial data
    const userId = new mongoose.Types.ObjectId(req.user.id);
    
    const typeTotals = await Transaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
        },
      },
    ]);

    let allTimeIncome = 0;
    let allTimeExpense = 0;

    typeTotals.forEach(({ _id, total }) => {
      if (_id === "income") allTimeIncome = total;
      else if (_id === "expense") allTimeExpense = total;
    });

    // Approximate monthly averages based on activity duration
    const dateRange = await Transaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          minDate: { $min: "$date" },
          maxDate: { $max: "$date" }
        }
      }
    ]);

    let monthsActive = 1;
    if (dateRange.length > 0 && dateRange[0].minDate && dateRange[0].maxDate) {
      const minDate = new Date(dateRange[0].minDate);
      const maxDate = new Date(dateRange[0].maxDate);
      const diffTime = Math.abs(maxDate - minDate);
      const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
      if (diffMonths > 1) {
        monthsActive = diffMonths;
      }
    }

    const currentMonthlyIncome = Math.round((allTimeIncome / monthsActive) * 100) / 100;
    const currentMonthlyExpense = Math.round((allTimeExpense / monthsActive) * 100) / 100;
    const currentSavings = currentMonthlyIncome - currentMonthlyExpense;

    // 4. Adjust budget after EMI
    const newExpense = currentMonthlyExpense + emi;
    
    // 5. Apply 50/30/20 rule
    const targetNeeds = currentMonthlyIncome * 0.5;
    const targetWants = currentMonthlyIncome * 0.3;
    const targetSavings = currentMonthlyIncome * 0.2;

    const updatedBudget = {
      income: currentMonthlyIncome,
      currentExpense: currentMonthlyExpense,
      newExpense: Math.round(newExpense * 100) / 100,
      currentSavings: Math.round(currentSavings * 100) / 100,
      newSavings: Math.round((currentMonthlyIncome - newExpense) * 100) / 100,
      rule503020: {
        needsLimit: targetNeeds,
        wantsLimit: targetWants,
        savingsTarget: targetSavings
      }
    };

    // 6. Compare EMI with savings and generate alerts
    let loanStatus = "Safe";
    const recommendations = [];

    if (emi > currentSavings) {
      loanStatus = "Risky";
      recommendations.push("Your EMI exceeds your current monthly savings. You will face a deficit if you don't reduce other expenses.");
    }

    if (newExpense > targetNeeds + targetWants) {
      // Meaning their total expense exceeds 80% (needs+wants)
      loanStatus = "Risky";
      recommendations.push("Your total expenses after this EMI will exceed 80% of your income. Consider a longer tenure to reduce the monthly burden.");
    }

    if (emi > (currentMonthlyIncome * 0.4)) {
      loanStatus = "Risky";
      recommendations.push("This EMI is more than 40% of your income. Lenders typically consider this a high risk.");
    }

    if (loanStatus === "Safe") {
      recommendations.push("Your budget can comfortably accommodate this EMI without cutting into your 20% savings target.");
    } else {
      recommendations.push("Focus on increasing down payment or extending the loan tenure.");
      recommendations.push("Reduce discretionary spending (Wants) to afford this EMI.");
    }

    // 7. Return detailed response
    return res.json({
      loanDetails: {
        loanAmount: P,
        interestRate,
        tenureMonths: n
      },
      emi,
      loanStatus,
      updatedBudget,
      recommendations,
      repaymentSchedule
    });

  } catch (error) {
    console.error("Loan Calculation Error:", error);
    res.status(500).json({ error: "Failed to calculate loan details" });
  }
};

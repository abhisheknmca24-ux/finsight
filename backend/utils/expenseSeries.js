function toMonthKey(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function aggregateMonthlyExpenseSeries(transactions) {
  const expenseByMonth = new Map();

  (transactions || []).forEach((tx) => {
    if (tx.type !== "expense") return;
    const monthKey = toMonthKey(tx.date);
    if (!monthKey) return;
    expenseByMonth.set(monthKey, (expenseByMonth.get(monthKey) || 0) + Number(tx.amount || 0));
  });

  return Array.from(expenseByMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, total]) => ({
      month,
      total: Number(total.toFixed(2)),
    }));
}

function getExpenseSeriesValues(transactions, minPoints = 2) {
  const series = aggregateMonthlyExpenseSeries(transactions);
  const values = series.map((point) => point.total);
  if (values.length < minPoints) {
    return {
      series,
      values,
      insufficientData: true,
    };
  }
  return {
    series,
    values,
    insufficientData: false,
  };
}

function estimateMonthlyIncome(transactions) {
  const incomeByMonth = new Map();

  (transactions || []).forEach((tx) => {
    if (tx.type !== "income") return;
    const monthKey = toMonthKey(tx.date);
    if (!monthKey) return;
    incomeByMonth.set(monthKey, (incomeByMonth.get(monthKey) || 0) + Number(tx.amount || 0));
  });

  const monthlyIncomeValues = Array.from(incomeByMonth.values());
  if (monthlyIncomeValues.length === 0) return 0;

  const avg = monthlyIncomeValues.reduce((sum, val) => sum + val, 0) / monthlyIncomeValues.length;
  return Number(avg.toFixed(2));
}

module.exports = {
  aggregateMonthlyExpenseSeries,
  getExpenseSeriesValues,
  estimateMonthlyIncome,
};

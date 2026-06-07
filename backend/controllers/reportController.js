const PDFDocument = require("pdfkit");
const Transaction = require("../models/Transaction"); 
const fs = require("fs");

const width = 500;
const height = 300;
let chartCanvas = null;

const getChartCanvas = () => {
  if (chartCanvas) return chartCanvas;

  const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
  chartCanvas = new ChartJSNodeCanvas({ width, height, chartCallback });
  return chartCanvas;
};

const chartCallback = (ChartJS) => {
  ChartJS.defaults.color = '#333';
  ChartJS.defaults.font.family = 'Helvetica';
  ChartJS.register({
    id: "custom_canvas_background_color",
    beforeDraw: (chart) => {
      const ctx = chart.canvas.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    }
  });
};

async function generatePieChart(categoryTotals) {
  const canvas = getChartCanvas();
  const configuration = {
    type: "pie",
    data: {
      labels: Object.keys(categoryTotals).length ? Object.keys(categoryTotals) : ['None'],
      datasets: [{
        data: Object.values(categoryTotals).length ? Object.values(categoryTotals) : [1],
        backgroundColor: [
          "#6366f1", "#10b981", "#f43f5e", "#f59e0b", "#3b82f6",
          "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
        ]
      }]
    },
    options: { plugins: { legend: { position: 'right' } } }
  };
  return await canvas.renderToBuffer(configuration);
}

async function generateLineChart(monthlyData) {
  const canvas = getChartCanvas();
  const configuration = {
    type: "line",
    data: {
      labels: monthlyData.length ? monthlyData.map(m => m.month) : ['N/A'],
      datasets: [
        {
          label: "Income",
          data: monthlyData.length ? monthlyData.map(m => m.income) : [0],
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          fill: true,
          tension: 0.4
        },
        {
          label: "Expense",
          data: monthlyData.length ? monthlyData.map(m => m.expense) : [0],
          borderColor: "#f43f5e",
          backgroundColor: "rgba(244, 63, 94, 0.1)",
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: { scales: { y: { beginAtZero: true } } }
  };
  return await canvas.renderToBuffer(configuration);
}


function drawTable(doc, headers, rows) {
  const startX = 50;
  let y = doc.y;

  doc.font("Helvetica-Bold").fontSize(12);
  // Optional: add a light background for header
  doc.rect(startX - 5, y - 5, doc.page.width - 90, 20).fill('#f1f5f9');
  doc.fillColor('#0f172a');
  
  headers.forEach((header, i) => {
    // Dynamic column width distribution based on header count
    const colWidth = (doc.page.width - 100) / headers.length;
    doc.text(header, startX + i * colWidth, y);
  });

  doc.moveDown(1);
  doc.font("Helvetica").fontSize(11).fillColor('#334155');

  rows.forEach(row => {
    // Check if new page is needed mid-table
    if (doc.y > doc.page.height - 100) {
      doc.addPage();
    }
    y = doc.y;
    row.forEach((cell, i) => {
      const colWidth = (doc.page.width - 100) / headers.length;
      doc.text(String(cell), startX + i * colWidth, y, { width: colWidth - 10, align: 'left' });
    });
    doc.moveDown(0.7);
    doc.moveTo(startX, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.5);
  });
}

function generateProfessionalPDF(data, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=Professional_Report.pdf");

  doc.pipe(res);

  // ==============================
  // 🟣 COVER PAGE
  // ==============================
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8fafc');

  doc.fillColor('#1e293b');
  doc.moveDown(5);

  const logoPath = require("path").join(__dirname, "../../frontend/public/logo.png");
  if (fs.existsSync(logoPath)) {
    try {
      // Use 'fit' constraints rather than strict width to ensure no distortion for tall logos
      doc.image(logoPath, (doc.page.width / 2) - 40, doc.y, { fit: [80, 80], align: "center" });
      doc.moveDown(7);
    } catch (e) {
      console.error("Could not load logo in PDF", e);
    }
  }

  doc.fontSize(36).font('Helvetica-Bold').text("FinSight", { align: "center" });
  doc.fontSize(14).font('Helvetica').fillColor('#64748b').text("Smart Expense Tracking", { align: "center" });
  doc.moveDown(4);
  
  doc.fontSize(24).font('Helvetica-Bold').fillColor('#0f172a').text("Financial Intelligence Report", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).font('Helvetica').fillColor('#475569').text(`Generated on: ${new Date().toDateString()}`, { align: "center" });

  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff'); 

  const drawSectionHeader = (title) => {
    doc.fillColor('#0f172a');
    doc.fontSize(18).font('Helvetica-Bold').text(title);
    doc.moveDown(0.5);
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(1);
  };

  // ==============================
  // 🟢 SUMMARY TABLE
  // ==============================
  drawSectionHeader("Financial Summary");

  drawTable(doc,
    ["Metric", "Value"],
    [
      ["Total Income", `₹${data.income.toLocaleString()}`],
      ["Total Expense", `₹${data.expense.toLocaleString()}`],
      ["Savings", `₹${data.savings.toLocaleString()}`],
    ]
  );
  doc.moveDown(2);

  // ==============================
  // 📈 MONTHLY TREND TABLE & CHART
  // ==============================
  drawSectionHeader("Monthly Trend Analysis");

  const monthRows = data.monthlyData.map(m => [
    m.month,
    `₹${m.income.toLocaleString()}`,
    `₹${m.expense.toLocaleString()}`
  ]);
  drawTable(doc, ["Month", "Income", "Expense"], monthRows);
  doc.moveDown(2);

  generateLineChart(data.monthlyData).then(lineBuffer => {
    if (doc.y > doc.page.height - 300) doc.addPage();
    doc.image(lineBuffer, { width: 400, align: 'center' });
    doc.moveDown(2);

    // ==============================
    // 🔵 CATEGORY TABLE & PIE CHART
    // ==============================
    doc.addPage();
    drawSectionHeader("Category Breakdown");

    const categoryRows = Object.entries(data.categoryTotals)
      .sort((a,b) => b[1] - a[1])
      .map(([cat, val]) => [cat.charAt(0).toUpperCase() + cat.slice(1), `₹${val.toLocaleString()}`]);
    
    drawTable(doc, ["Category", "Amount"], categoryRows);
    doc.moveDown(2);

    generatePieChart(data.categoryTotals).then(pieBuffer => {
      if (doc.y > doc.page.height - 300) doc.addPage();
      doc.image(pieBuffer, { width: 400, align: 'center' });
      doc.moveDown(2);

      // ==============================
      // 📊 TRANSACTION TABLE (TOP 10)
      // ==============================
      doc.addPage();
      drawSectionHeader("Recent Transactions");

      const txnRows = data.transactions.slice(0, 15).map(t => [
        new Date(t.date).toLocaleDateString("en-IN"),
        t.category ? t.category.charAt(0).toUpperCase() + t.category.slice(1) : "Other",
        `${t.type === 'income' ? '+' : '-'}₹${t.amount.toLocaleString()}`
      ]);

      drawTable(doc, ["Date", "Category", "Amount"], txnRows);
      doc.moveDown(2);

      // ==============================
      // 🧠 RECOMMENDATIONS
      // ==============================
      if (doc.y > doc.page.height - 200) doc.addPage();
      drawSectionHeader("Recommendations");

      doc.fontSize(12).font('Helvetica');
      data.recommendations.forEach(rec => {
        doc.text(`• ${rec}`);
        doc.moveDown(0.7);
      });

      doc.end();
    }).catch(err => {
      console.error(err);
      doc.end();
    });
  }).catch(err => {
    console.error(err);
    doc.end();
  });
}

exports.generateReport = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(401).json({ error: "User unauthorized" });
    }

    const transactions = await Transaction.find({ userId }).sort({ date: -1 });

    let income = 0;
    let expense = 0;
    const categoryTotals = {};
    const monthlyDataMap = {};

    transactions.forEach(t => {
      const amt = t.amount || 0;
      if (t.type === "income") income += amt;
      else if (t.type === "expense") expense += amt;

      if (t.type === "expense") {
        const cat = t.category || "other";
        if (!categoryTotals[cat]) categoryTotals[cat] = 0;
        categoryTotals[cat] += amt;
      }

      // monthly grouping - short month format "Jan 2026"
      const d = new Date(t.date);
      const month = d.toLocaleString("default", { month: "short", year: "numeric" });

      if (!monthlyDataMap[month]) {
        monthlyDataMap[month] = { income: 0, expense: 0, _date: d };
      }

      if (t.type === "income") {
        monthlyDataMap[month].income += amt;
      } else if (t.type === "expense") {
        monthlyDataMap[month].expense += amt;
      }
    });

    const savings = income - expense;

    const monthlyData = Object.keys(monthlyDataMap)
      .sort((a,b) => monthlyDataMap[a]._date - monthlyDataMap[b]._date)
      .map(month => ({
        month,
        income: monthlyDataMap[month].income,
        expense: monthlyDataMap[month].expense
      }));

    let recommendations = [];
    if (expense > income && income > 0) {
      recommendations.push("🚨 Reduce expenses, you are spending more than your monthly total averaged income.");
    } else if (income - expense > income * 0.2) {
      recommendations.push("🎉 Great job saving! Consider systematically investing your surplus into Mutual Funds.");
    } else {
      recommendations.push("💡 Try the 50/30/20 rule to maximize savings. Aim for at least 20% savings margin.");
    }

    if (recommendations.length === 0) {
      recommendations.push("Keep tracking your expenses diligently to get more tailored financial intelligence.");
    }

    const data = {
      income,
      expense,
      savings,
      categoryTotals,
      monthlyData,
      transactions, // pass transactions for the table
      recommendations
    };

    generateProfessionalPDF(data, res);

  } catch (err) {
    console.error("Error generating professional report:", err);
    res.status(500).json({ error: err.message });
  }
};

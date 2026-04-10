require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

// Connect DB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/predict", require("./routes/predictionRoutes"));
app.use("/api/predictions", require("./routes/predictionRoutes"));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/expenses", require("./routes/expenseRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/budget", require("./routes/budgetRoutes"));
app.use("/api/score", require("./routes/scoreRoutes"));
app.use("/api/recommendations", require("./routes/recommendationRoutes"));
app.use("/api/report", require("./routes/reportRoutes"));
app.use("/api/loan", require("./routes/loanRoutes"));

// Test route
app.get("/", (req, res) => {
  res.send("Finghit API Running...");
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API working", status: "ok" });
});

// Error handling middleware (must be after routes)
app.use(notFound);
app.use(errorHandler);

// Server
app.listen(process.env.PORT, () =>
  console.log(`Server running on ${process.env.PORT}`)
);
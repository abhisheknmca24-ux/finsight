const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than 0"],
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: ["income", "expense", "investment"],
        message: "Type must be income, expense, or investment",
      },
    },
    category: {
      type: String,
      required: true,
      default: "other",
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    uploadMonth: {
      type: String, // YYYY-MM format
      index: true,
    },
    uploadDate: {
      type: Date,
    },
    source: {
      type: String,
      enum: ["manual", "csv", "pdf"],
      default: "manual",
    },
  },
  { timestamps: true }
);

// Compound index for duplicate detection
transactionSchema.index(
  { userId: 1, amount: 1, date: 1, description: 1 },
  { name: "duplicate_check_idx" }
);

// Indexes for pagination and filtering
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1, category: 1 });
transactionSchema.index({ userId: 1, uploadMonth: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
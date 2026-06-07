const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ["stock", "mutual_fund", "bond", "crypto", "other"], default: "other" },
  currentValue: { type: Number },
  purchaseDate: { type: Date, default: Date.now },
  description: String,
}, { timestamps: true });

module.exports = mongoose.model("Investment", investmentSchema);

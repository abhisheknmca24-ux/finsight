const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    firebaseUid: String,
    dob: Date,
    gender: { type: String, enum: ["male", "female", "other"] },
    phone: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
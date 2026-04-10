const express = require("express");
const auth = require("../middleware/authMiddleware");
const { calculateLoan } = require("../controllers/loanController");

const router = express.Router();

// Calculate EMI and budget details
router.post("/calculate", auth, calculateLoan);

module.exports = router;

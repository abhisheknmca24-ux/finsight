const express = require("express");
const router = express.Router();
const { generateReport } = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");

// GET /api/report
router.get("/", authMiddleware, generateReport);

module.exports = router;

const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const { setBudget, getBudgetStatus, updateBudget, deleteBudget } = require("../controllers/budgetController");

router.post("/", auth, setBudget);
router.get("/status", auth, getBudgetStatus);
router.put("/:id", auth, updateBudget);
router.delete("/:id", auth, deleteBudget);

module.exports = router;
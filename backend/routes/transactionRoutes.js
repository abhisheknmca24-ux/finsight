const router = require("express").Router();

const auth = require("../middleware/authMiddleware"); 

const transactionController = require("../controllers/transactionController");

// ✅ ROUTES
router.post("/", auth, transactionController.addTransaction);
router.get("/", auth, transactionController.getTransactions);
router.put("/:id", auth, transactionController.updateTransaction);
router.delete("/:id", auth, transactionController.deleteTransaction);

router.post("/rules", auth, transactionController.addCategoryRule);

module.exports = router;
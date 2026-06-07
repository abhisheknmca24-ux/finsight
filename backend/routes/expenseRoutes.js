const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const Transaction = require("../models/Transaction");
const {
  syncTransactionToFirestore,
  deleteTransactionFromFirestore,
} = require("../utils/firestoreSync");

// @route   GET /api/expenses
// @desc    Get all expenses for logged in user
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const match = {
      userId: req.user.id,
      type: "expense"
    };

    const [expenses, total] = await Promise.all([
      Transaction.find(match)
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Transaction.countDocuments(match)
    ]);
    
    res.json({
      expenses,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      }
    });
  } catch (err) {
    console.error("[Expenses] Error fetching:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/expenses
// @desc    Add a new expense
// @access  Private
router.post("/", auth, async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;
    
    const expense = new Transaction({
      userId: req.user.id,
      amount,
      type: "expense",
      category,
      description,
      date: date || new Date()
    });
    
    await expense.save();
    
    // Fire-and-forget Firestore sync
    syncTransactionToFirestore(expense);
    
    res.status(201).json(expense);
  } catch (err) {
    console.error("[Expenses] Error adding:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete an expense
// @access  Private
router.delete("/:id", auth, async (req, res) => {
  try {
    const expense = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    
    // Fire-and-forget Firestore delete
    deleteTransactionFromFirestore(req.user.id, req.params.id);
    
    res.json({ message: "Expense deleted" });
  } catch (err) {
    console.error("[Expenses] Error deleting:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

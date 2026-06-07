const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const {
	predictExpense,
	predictYearEnd,
	predictCategoryWise,
} = require("../controllers/predictionController");

router.post("/", auth, predictExpense);
router.post("/yearend", auth, predictYearEnd);
router.get("/categories", auth, predictCategoryWise);

module.exports = router;
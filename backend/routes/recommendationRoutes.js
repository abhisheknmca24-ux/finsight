const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const { getRecommendations } = require("../controllers/recommendationController");

router.get("/", auth, getRecommendations);

module.exports = router;

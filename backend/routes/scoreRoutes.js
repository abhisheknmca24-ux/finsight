const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const { getScore } = require("../controllers/scoreController");

router.get("/", auth, getScore);

module.exports = router;
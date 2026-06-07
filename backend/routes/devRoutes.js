const router = require("express").Router();
const { computeRecommendationsForUser } = require("../controllers/recommendationController");
const User = require("../models/User");

// Dev-only: compute recommendations for a given userId (no auth)
router.get("/recommendations", async (req, res) => {
  try {
    let userId = req.query.userId;
    if (!userId) {
      const user = await User.findOne().lean();
      if (!user) return res.status(400).json({ error: "No users in DB to test against. Add a user first." });
      userId = user._id.toString();
    }
    const data = await computeRecommendationsForUser(userId);
    res.json({ userId, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

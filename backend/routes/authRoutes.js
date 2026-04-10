const router = require("express").Router();
const { register, login, firebaseLogin } = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.post("/firebase-login", firebaseLogin);

module.exports = router;
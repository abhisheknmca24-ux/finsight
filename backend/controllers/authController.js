const User = require("../models/User");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const { verifyFirebaseToken, isFirebaseReady } = require("../config/firebase");

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.json({
      token: generateToken(user._id),
      user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        token: generateToken(user._id),
        user,
      });
    } else {
      res.status(400).json({ message: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.firebaseLogin = async (req, res) => {
  try {
    const { email, name, firebaseUid, idToken } = req.body;

    // ── Server-side Firebase token verification (enhanced security) ──
    if (idToken && isFirebaseReady()) {
      const decoded = await verifyFirebaseToken(idToken);
      if (!decoded) {
        return res.status(401).json({ message: "Invalid Firebase token" });
      }
      // Use verified data from token instead of trusting client
      if (decoded.email !== email) {
        return res.status(401).json({ message: "Token email mismatch" });
      }
    }

    let user = await User.findOne({ email });

    if (!user) {
      // Create user if they don't exist
      user = await User.create({
        name: name || email.split("@")[0],
        email,
        password: "firebase_user_" + firebaseUid, // Not intended for login
        firebaseUid: firebaseUid || null,
      });
    } else if (firebaseUid && !user.firebaseUid) {
      // Link Firebase UID to existing user
      user.firebaseUid = firebaseUid;
      await user.save();
    }

    res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        firebaseUid: user.firebaseUid || firebaseUid,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
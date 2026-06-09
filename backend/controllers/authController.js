const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { verifyFirebaseToken, isFirebaseReady } = require("../config/firebase");

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  dob: user.dob,
  gender: user.gender,
  phone: user.phone,
  firebaseUid: user.firebaseUid,
});

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
      user: sanitizeUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        token: generateToken(user._id),
        user: sanitizeUser(user),
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
    res.status(500).json({ error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, dob, gender, phone } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = name || user.name;
    user.dob = dob || user.dob;
    user.gender = gender || user.gender;
    user.phone = phone || user.phone;

    const updatedUser = await user.save();
    res.json(sanitizeUser(updatedUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!isMatch) return res.status(400).json({ message: "Incorrect current password" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
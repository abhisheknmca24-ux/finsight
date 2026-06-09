const jwt = require("jsonwebtoken");
const { verifyFirebaseToken, isFirebaseReady } = require("../config/firebase");

/**
 * Dual-mode auth middleware:
 * 1. Tries JWT verification first (existing flow)
 * 2. Falls back to Firebase ID token verification (Google Sign-In flow)
 */
module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token" });
  }

  // ── Try JWT first (primary auth method) ─────────────────────────────
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (jwtErr) {
    // JWT failed — try Firebase token if available
  }

  // ── Try Firebase ID token (secondary auth method) ───────────────────
  if (isFirebaseReady()) {
    const decoded = await verifyFirebaseToken(token);
    if (decoded) {
      req.user = {
        id: decoded.uid,
        email: decoded.email,
        firebaseAuth: true,
      };
      return next();
    }
  }

  return res.status(401).json({ message: "Not authorized" });
};
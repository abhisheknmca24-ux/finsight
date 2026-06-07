const jwt = require("jsonwebtoken");
const { verifyFirebaseToken, isFirebaseReady } = require("../config/firebase");

/**
 * Dual-mode auth middleware:
 * 1. Tries JWT verification first (existing flow)
 * 2. Falls back to Firebase ID token verification (Google Sign-In flow)
 */
module.exports = async (req, res, next) => {
  let token = req.headers.authorization;

  if (!token || !token.startsWith("Bearer")) {
    return res.status(401).json({ message: "No token" });
  }

  token = token.split(" ")[1];

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
      // Map Firebase token claims to the same shape as JWT
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
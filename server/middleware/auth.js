const jwt = require("jsonwebtoken");

// Run this before any protected route.
// It reads the "Authorization: Bearer <token>" header, verifies the JWT,
// and puts the logged-in user's id on `req.userId`. Otherwise: 401.
module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

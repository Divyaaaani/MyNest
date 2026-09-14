// Shared strong-password helpers — used by Zod schemas in routes/auth.js
// Policy: 8–128 chars, at least one uppercase, one lowercase, one digit,
// one special character, no spaces, not a common password.

const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "12345678",
  "123456789",
  "qwerty123",
  "abc123456",
  "letmein",
  "welcome",
  "admin123",
  "1234567890",
]);

function getPasswordErrors(password) {
  const errors = [];
  if (typeof password !== "string") {
    errors.push("password is required");
    return errors;
  }
  if (password.length < 8) errors.push("password must be at least 8 characters");
  if (password.length > 128) errors.push("password must be at most 128 characters");
  if (/\s/.test(password)) errors.push("password must not contain spaces");
  if (!/[A-Z]/.test(password)) errors.push("password must contain at least one uppercase letter (A-Z)");
  if (!/[a-z]/.test(password)) errors.push("password must contain at least one lowercase letter (a-z)");
  if (!/[0-9]/.test(password)) errors.push("password must contain at least one number (0-9)");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("password must contain at least one special character (e.g. !@#$%^&*)");
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("password is too common — choose a more unique one");
  }
  return errors;
}

function isStrongPassword(password) {
  return getPasswordErrors(password).length === 0;
}

// Strength score 0–4 for UI (independent of hard validation)
function getPasswordStrength(password) {
  if (!password) return { score: 0, label: "", percent: 0 };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
  const percents = [5, 25, 50, 75, 100];
  return { score, label: labels[score], percent: percents[score] };
}

module.exports = { getPasswordErrors, isStrongPassword, getPasswordStrength };

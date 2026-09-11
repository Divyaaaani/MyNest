// Reusable request-body validator built on Zod.
// Usage: router.post("/login", validate(loginSchema), async (req, res) => {...})
// On failure responds 400 with machine-readable details; on success
// replaces req.body with the parsed (typed/coerced) value.
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: result.error.issues.map((i) => ({
          field: i.path.join(".") || "(body)",
          message: i.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };

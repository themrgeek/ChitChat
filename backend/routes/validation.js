const validator = require("validator");

const validateRegistration = (req, res, next) => {
  const { nationalId, email } = req.body;

  // Validate national ID (basic check)
  if (!nationalId || !/^[A-Z0-9]{8,20}$/.test(nationalId)) {
    return res.status(400).json({
      error: "Invalid national ID format",
    });
  }

  // Validate email
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({
      error: "Invalid email address",
    });
  }

  next();
};

module.exports = { validateRegistration };

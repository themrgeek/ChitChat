const express = require("express");
const router = express.Router();

// Chat-related routes can be added here
router.get("/test", (req, res) => {
  res.json({ message: "Chat routes working" });
});

module.exports = router;

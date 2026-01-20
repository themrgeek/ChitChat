const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      "mongodb://localhost:27017/chitchat";

    const isProduction = process.env.NODE_ENV === "production";

    const options = {
      // Connection pool - more connections for production
      maxPoolSize: isProduction ? 50 : 10,
      minPoolSize: isProduction ? 5 : 1,
      // Timeouts
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      // Performance
      family: 4, // Use IPv4
      // Write concern for better performance
      w: "majority",
      retryWrites: true,
      retryReads: true,
      // Compression
      compressors: ["zlib"],
    };

    const conn = await mongoose.connect(mongoURI, options);

    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("🔄 MongoDB reconnected");
    });

    return conn;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    // Don't exit in production, allow retries
    if (process.env.NODE_ENV !== "production") {
      console.log("⚠️ Running without database - using in-memory storage");
    }
    return null;
  }
};

const closeDB = async () => {
  try {
    await mongoose.connection.close();
    console.log("📦 MongoDB connection closed");
  } catch (error) {
    console.error("Error closing MongoDB connection:", error);
  }
};

module.exports = { connectDB, closeDB };

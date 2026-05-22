const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      "mongodb://localhost:27017/chitchat";

    const isProduction = process.env.NODE_ENV === "production";

    const options = {
      // what is pool size?
      // Pool size is the maximum number of connections that can be open to the database.
      // The default pool size is 10.
      // The max pool size is the maximum number of connections that can be open to the database.
      // The min pool size is the minimum number of connections that can be open to the database.
      // The default min pool size is 1.
      // The max pool size is the maximum number of connections that can be open to the database.
      // The min pool size is the minimum number of connections that can be open to the database.
      // The default min pool size is 1.
      // Connection pool - more connections for production
      maxPoolSize: isProduction ? 50 : 10, // 50 connections for production, 10 connections for development
      // 50 connection for production, means it can handle 50 concurrent users am I right? but if i have 50 users, it will use 50 connections? no, it will use the number of users connected to the database. so if i have 50 users, it will use 50 connections.

      minPoolSize: isProduction ? 5 : 1, // 5 connections for production, 1 connection for development
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

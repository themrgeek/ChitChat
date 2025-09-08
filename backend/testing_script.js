const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("server"); // Assuming server.js exports the Express app
const User = require("../models/User");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("Authentication API", () => {
  it("should register a new user", async () => {
    const response = await request(app).post("/api/auth/register").send({
      nationalId: "TEST123456",
      email: "test@example.com",
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("userId");
    expect(response.body).toHaveProperty("anonymousCredentials");
  });

  it("should login with valid credentials", async () => {
    const response = await request(app).post("/api/auth/login").send({
      nationalId: "TEST123456",
      email: "test@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("sessionId");
    expect(response.body).toHaveProperty("anonymousId");
  });
});

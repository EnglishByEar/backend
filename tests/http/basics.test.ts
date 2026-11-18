import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";

// These tests never reach the database: every request is rejected earlier.
describe("HTTP basics", () => {
  it("GET /api/health returns 200", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("sets security headers (helmet)", async () => {
    const res = await request(app).get("/api/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("returns 404 JSON for unknown routes", async () => {
    const res = await request(app).get("/api/nope");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Route not found" });
  });

  it("returns 400 (not 500) for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad json");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: "Invalid JSON body" });
  });

  it("returns 400 with issues for an invalid register body", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "A", email: "not-an-email", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("returns 400 when the body is missing entirely", async () => {
    const res = await request(app).post("/api/auth/login");

    expect(res.status).toBe(400);
  });

  it("requires a bearer token for /api/auth/me", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Authentication required");
  });

  it("rejects a garbage bearer token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not.a.jwt");

    expect(res.status).toBe(401);
  });

  it("requires a refresh cookie for /api/auth/refresh", async () => {
    const res = await request(app).post("/api/auth/refresh");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Refresh token is required");
  });

  it("validates exercise query parameters and ids", async () => {
    const badLimit = await request(app).get("/api/exercises?limit=999");
    expect(badLimit.status).toBe(400);

    const badDifficulty = await request(app).get("/api/exercises?difficulty=Hard");
    expect(badDifficulty.status).toBe(400);

    const badId = await request(app).get("/api/exercises/not-an-id");
    expect(badId.status).toBe(400);
  });

  it("requires authentication to submit an exercise", async () => {
    const res = await request(app)
      .post("/api/exercises/507f1f77bcf86cd799439011/submit")
      .send({ userText: "hello" });

    expect(res.status).toBe(401);
  });
});

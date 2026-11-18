import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { Session } from "../../src/modules/auth/session.model.js";
import { User } from "../../src/modules/auth/auth.model.js";
import { clearTestDb, startTestDb, stopTestDb } from "../helpers/db.js";
import {
  getRefreshCookie,
  refreshWith,
  registerAndLogin,
  testUser,
} from "../helpers/auth.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe("POST /api/auth/register", () => {
  it("creates an account without leaking the password", async () => {
    const res = await request(app).post("/api/auth/register").send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      name: testUser.name,
      email: testUser.email,
    });
    expect(JSON.stringify(res.body)).not.toContain(testUser.password);
    expect(res.body.user.password).toBeUndefined();
  });

  it("stores a bcrypt hash, not the password", async () => {
    await request(app).post("/api/auth/register").send(testUser);

    const user = await User.findOne({ email: testUser.email }).select("+password");

    expect(user?.password).not.toBe(testUser.password);
    expect(user?.password).toMatch(/^\$2[aby]\$/);
  });

  it("rejects a duplicate email (case-insensitive) with 409", async () => {
    await request(app).post("/api/auth/register").send(testUser);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...testUser, email: testUser.email.toUpperCase() });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  it("returns an access token and an httpOnly refresh cookie", async () => {
    const { response } = await registerAndLogin();

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toBeUndefined(); // cookie only

    const cookie = ([] as string[])
      .concat(response.headers["set-cookie"] ?? [])
      .find((c) => c.startsWith("refreshToken="))!;

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/api/auth");
    expect(await Session.countDocuments()).toBe(1);
  });

  it("stores only a hash of the refresh token", async () => {
    const { refreshToken } = await registerAndLogin();
    const session = await Session.findOne();

    expect(session?.refreshTokenHash).toBeDefined();
    expect(session?.refreshTokenHash).not.toBe(refreshToken);
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    await request(app).post("/api/auth/register").send(testUser);

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: testUser.email, password: "wrong-password" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever-123" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it("rejects deactivated users", async () => {
    await registerAndLogin();
    await User.updateOne({ email: testUser.email }, { isActive: false });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user for a valid access token", async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user.password).toBeUndefined();
  });

  it("rejects a valid token once the user is deactivated", async () => {
    const { accessToken } = await registerAndLogin();
    await User.updateOne({ email: testUser.email }, { isActive: false });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  it("rotates the refresh token and issues a working access token", async () => {
    const { refreshToken } = await registerAndLogin();

    const res = await refreshWith(refreshToken);

    expect(res.status).toBe(200);
    expect(getRefreshCookie(res)).not.toBe(refreshToken);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);

    expect(await Session.countDocuments()).toBe(1); // rotated in place
  });

  it("rejects the old token after rotation", async () => {
    const { refreshToken: tokenA } = await registerAndLogin();
    await refreshWith(tokenA);

    const replay = await refreshWith(tokenA);

    expect(replay.status).toBe(401);
  });

  it("within the grace window a replay is rejected but the session survives", async () => {
    const { refreshToken: tokenA } = await registerAndLogin();
    const rotated = await refreshWith(tokenA);
    const tokenB = getRefreshCookie(rotated);

    const replay = await refreshWith(tokenA);
    expect(replay.status).toBe(401);

    const stillWorks = await refreshWith(tokenB);
    expect(stillWorks.status).toBe(200);
  });

  it("revokes the session when an old token is replayed after the grace window", async () => {
    const { refreshToken: tokenA } = await registerAndLogin();
    const rotated = await refreshWith(tokenA);
    const tokenB = getRefreshCookie(rotated);

    // Pretend the rotation happened a minute ago.
    await Session.updateMany({}, { rotatedAt: new Date(Date.now() - 60_000) });

    const replay = await refreshWith(tokenA);
    expect(replay.status).toBe(401);
    expect(await Session.countDocuments()).toBe(0);

    // The legitimate holder of token B is logged out too.
    const afterTheft = await refreshWith(tokenB);
    expect(afterTheft.status).toBe(401);
  });

  it("rejects a tampered or foreign token", async () => {
    const res = await refreshWith("not.a.valid.token");

    expect(res.status).toBe(401);
  });

  it("rejects an expired session", async () => {
    const { refreshToken } = await registerAndLogin();
    await Session.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });

    const res = await refreshWith(refreshToken);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("deletes the session and clears the cookie", async () => {
    const { refreshToken } = await registerAndLogin();

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `refreshToken=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(await Session.countDocuments()).toBe(0);

    const refreshed = await refreshWith(refreshToken);
    expect(refreshed.status).toBe(401);
  });

  it("succeeds even without a cookie", async () => {
    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(200);
  });
});

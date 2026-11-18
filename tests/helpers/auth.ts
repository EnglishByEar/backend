import request from "supertest";
import type { Response } from "supertest";
import app from "../../src/app.js";

export const testUser = {
  name: "Test User",
  email: "test@example.com",
  password: "correct-horse-battery",
};

export async function registerAndLogin(user = testUser) {
  await request(app).post("/api/auth/register").send(user);

  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: user.email, password: user.password });

  return {
    accessToken: res.body.accessToken as string,
    refreshToken: getRefreshCookie(res),
    response: res,
  };
}

/** Extracts the raw refresh token from a response's Set-Cookie header. */
export function getRefreshCookie(res: Response): string {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const cookie = cookies.find((c) => c.startsWith("refreshToken="));

  if (!cookie) throw new Error("No refreshToken cookie in response");

  return cookie.split(";")[0]!.slice("refreshToken=".length);
}

export function refreshWith(token: string) {
  return request(app)
    .post("/api/auth/refresh")
    .set("Cookie", `refreshToken=${token}`);
}

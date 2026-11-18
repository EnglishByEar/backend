import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { Exercise } from "../../src/modules/exercises/exercise.model.js";
import { ExerciseResult } from "../../src/modules/exercises/exercise-result.model.js";
import { clearTestDb, startTestDb, stopTestDb } from "../helpers/db.js";
import { registerAndLogin } from "../helpers/auth.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

const TRANSCRIPT = "Ben waited at the bus stop. It was cold.";

async function seedExercises() {
  const [bus, shop, draft] = await Exercise.create([
    {
      slug: "the-bus-stop",
      title: "The Bus Stop",
      difficulty: "Simple",
      category: "Elementary",
      text: TRANSCRIPT,
      audioUrl: "https://cdn.example.com/bus.mp3",
      published: true,
    },
    {
      slug: "at-the-shop",
      title: "At the Shop",
      difficulty: "Medium",
      category: "Intermediate",
      text: "She bought bread and milk.",
      published: true,
    },
    {
      slug: "unfinished",
      title: "Unfinished Draft",
      difficulty: "Simple",
      category: "Elementary",
      text: "Not ready yet.",
      published: false,
    },
  ]);

  return { bus: bus!, shop: shop!, draft: draft! };
}

describe("GET /api/exercises", () => {
  it("lists only published exercises and never exposes the transcript", async () => {
    await seedExercises();

    const res = await request(app).get("/api/exercises");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 1, total: 2, totalPages: 1 });
    expect(JSON.stringify(res.body)).not.toContain("Ben waited");
    expect(res.body.items[0].text).toBeUndefined();
    expect(res.body.items[0]).toMatchObject({
      title: "The Bus Stop",
      audioUrl: "https://cdn.example.com/bus.mp3",
    });
  });

  it("filters by difficulty and category", async () => {
    await seedExercises();

    const byDifficulty = await request(app).get("/api/exercises?difficulty=Medium");
    expect(byDifficulty.body.items.map((i: { title: string }) => i.title)).toEqual([
      "At the Shop",
    ]);

    const byCategory = await request(app).get("/api/exercises?category=Elementary");
    expect(byCategory.body.items).toHaveLength(1);
  });

  it("paginates", async () => {
    await seedExercises();

    const page1 = await request(app).get("/api/exercises?limit=1&page=1");
    const page2 = await request(app).get("/api/exercises?limit=1&page=2");

    expect(page1.body.items).toHaveLength(1);
    expect(page2.body.items).toHaveLength(1);
    expect(page1.body.items[0].id).not.toBe(page2.body.items[0].id);
    expect(page1.body.pagination).toMatchObject({ total: 2, totalPages: 2 });
  });
});

describe("GET /api/exercises/:id", () => {
  it("returns exercise details without the transcript", async () => {
    const { bus } = await seedExercises();

    const res = await request(app).get(`/api/exercises/${bus.id}`);

    expect(res.status).toBe(200);
    expect(res.body.exercise.title).toBe("The Bus Stop");
    expect(JSON.stringify(res.body)).not.toContain("Ben waited");
  });

  it("404s for unknown and unpublished exercises", async () => {
    const { draft } = await seedExercises();

    const unpublished = await request(app).get(`/api/exercises/${draft.id}`);
    expect(unpublished.status).toBe(404);

    const unknown = await request(app).get("/api/exercises/507f1f77bcf86cd799439011");
    expect(unknown.status).toBe(404);
  });
});

describe("POST /api/exercises/:id/submit", () => {
  it("scores a perfect answer, saves the result and reveals the transcript", async () => {
    const { bus } = await seedExercises();
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post(`/api/exercises/${bus.id}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ userText: "ben waited at the bus stop it was cold" });

    expect(res.status).toBe(201);
    expect(res.body.result).toMatchObject({
      accuracy: 100,
      mistakes: 0,
      totalWords: 9,
      transcript: TRANSCRIPT,
    });
    expect(await ExerciseResult.countDocuments()).toBe(1);
  });

  it("scores an imperfect answer", async () => {
    const { bus } = await seedExercises();
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post(`/api/exercises/${bus.id}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ userText: "Ben waited at the bus stop. It was hot." });

    expect(res.body.result).toMatchObject({ accuracy: 89, mistakes: 1 });
  });

  it("keeps every attempt as its own result", async () => {
    const { bus } = await seedExercises();
    const { accessToken } = await registerAndLogin();

    for (const userText of ["first try", "second try"]) {
      await request(app)
        .post(`/api/exercises/${bus.id}/submit`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ userText });
    }

    expect(await ExerciseResult.countDocuments()).toBe(2);
  });

  it("rejects empty answers and unpublished exercises", async () => {
    const { bus, draft } = await seedExercises();
    const { accessToken } = await registerAndLogin();

    const empty = await request(app)
      .post(`/api/exercises/${bus.id}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ userText: "   " });
    expect(empty.status).toBe(400);

    const unpublished = await request(app)
      .post(`/api/exercises/${draft.id}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ userText: "anything" });
    expect(unpublished.status).toBe(404);
  });
});

import { describe, expect, it } from "vitest";
import {
  normalizeToWords,
  scoreDictation,
  wordEditDistance,
} from "../../src/modules/exercises/exercise.scoring.js";

describe("normalizeToWords", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeToWords("Hello, World! It's 5 o'clock.")).toEqual([
      "hello",
      "world",
      "it's",
      "5",
      "o'clock",
    ]);
  });

  it("treats curly and straight apostrophes the same", () => {
    expect(normalizeToWords("don’t")).toEqual(normalizeToWords("don't"));
  });

  it("collapses whitespace and handles empty input", () => {
    expect(normalizeToWords("  a \n\t b  ")).toEqual(["a", "b"]);
    expect(normalizeToWords("   ")).toEqual([]);
  });
});

describe("wordEditDistance", () => {
  it("is 0 for identical sequences", () => {
    expect(wordEditDistance(["a", "b"], ["a", "b"])).toBe(0);
  });

  it("counts substitutions, insertions and deletions", () => {
    expect(wordEditDistance(["a", "b", "c"], ["a", "x", "c"])).toBe(1);
    expect(wordEditDistance(["a", "b", "c"], ["a", "c"])).toBe(1);
    expect(wordEditDistance(["a", "c"], ["a", "b", "c"])).toBe(1);
    expect(wordEditDistance([], ["a", "b"])).toBe(2);
  });
});

describe("scoreDictation", () => {
  const reference = "Ben waited at the bus stop. It was cold.";

  it("gives 100% for a perfect answer, ignoring case and punctuation", () => {
    expect(
      scoreDictation(reference, "ben waited at the bus stop it was cold")
    ).toEqual({ accuracy: 100, mistakes: 0, totalWords: 9 });
  });

  it("penalises each wrong, missing or extra word", () => {
    const wrong = scoreDictation(reference, "Ben waited at the bus stop. It was hot.");
    expect(wrong.mistakes).toBe(1);
    expect(wrong.accuracy).toBe(89);

    const missing = scoreDictation(reference, "Ben waited at the bus stop.");
    expect(missing.mistakes).toBe(3);
  });

  it("never goes below 0%", () => {
    const score = scoreDictation("one two", "a b c d e f g h");
    expect(score.accuracy).toBe(0);
  });

  it("gives 0% for an empty answer", () => {
    expect(scoreDictation(reference, "").accuracy).toBe(0);
  });
});

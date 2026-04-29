import { describe, expect, it } from "vitest";
import { computeHauntedScore, getScoreLabel } from "./db";

describe("computeHauntedScore", () => {
  it("returns 0 for a spot with no interactions", () => {
    const score = computeHauntedScore({ confirms: 0, debunks: 0, visits: 0 }, new Date());
    expect(score).toBe(0);
  });

  it("returns high score for mostly confirmed spot", () => {
    const score = computeHauntedScore({ confirms: 50, debunks: 3, visits: 10 }, new Date());
    expect(score).toBeGreaterThan(60);
  });

  it("returns low score for mostly debunked spot", () => {
    const score = computeHauntedScore({ confirms: 5, debunks: 40, visits: 2 }, new Date());
    expect(score).toBeLessThan(35);
  });

  it("returns mid-range score for controversial spot", () => {
    const score = computeHauntedScore({ confirms: 20, debunks: 22, visits: 5 }, new Date());
    expect(score).toBeGreaterThanOrEqual(20);
    expect(score).toBeLessThan(80);
  });

  it("applies recency decay for old spots", () => {
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000); // 200 days ago
    const newDate = new Date();
    const oldScore = computeHauntedScore({ confirms: 40, debunks: 5, visits: 8 }, oldDate);
    const newScore = computeHauntedScore({ confirms: 40, debunks: 5, visits: 8 }, newDate);
    expect(newScore).toBeGreaterThan(oldScore);
  });

  it("visit bonus increases score", () => {
    const noVisits = computeHauntedScore({ confirms: 20, debunks: 5, visits: 0 }, new Date());
    const withVisits = computeHauntedScore({ confirms: 20, debunks: 5, visits: 10 }, new Date());
    expect(withVisits).toBeGreaterThan(noVisits);
  });

  it("score is always between 0 and 100", () => {
    const extreme1 = computeHauntedScore({ confirms: 1000, debunks: 0, visits: 1000 }, new Date());
    const extreme2 = computeHauntedScore({ confirms: 0, debunks: 1000, visits: 0 }, new Date());
    expect(extreme1).toBeLessThanOrEqual(100);
    expect(extreme2).toBeGreaterThanOrEqual(0);
  });

  it("higher credibility increases score", () => {
    const lowCred = computeHauntedScore({ confirms: 20, debunks: 5, visits: 5 }, new Date(), 50);
    const highCred = computeHauntedScore({ confirms: 20, debunks: 5, visits: 5 }, new Date(), 200);
    expect(highCred).toBeGreaterThan(lowCred);
  });
});

describe("getScoreLabel", () => {
  it("labels score >= 60 as highly_haunted", () => {
    expect(getScoreLabel(60)).toBe("highly_haunted");
    expect(getScoreLabel(85)).toBe("highly_haunted");
    expect(getScoreLabel(100)).toBe("highly_haunted");
  });

  it("labels score 35-59 as controversial", () => {
    expect(getScoreLabel(35)).toBe("controversial");
    expect(getScoreLabel(50)).toBe("controversial");
    expect(getScoreLabel(59)).toBe("controversial");
  });

  it("labels score 1-34 as likely_fake", () => {
    expect(getScoreLabel(1)).toBe("likely_fake");
    expect(getScoreLabel(20)).toBe("likely_fake");
    expect(getScoreLabel(34)).toBe("likely_fake");
  });

  it("labels score 0 as unknown", () => {
    expect(getScoreLabel(0)).toBe("unknown");
  });
});

describe("auth.logout", () => {
  it("is covered in auth.logout.test.ts", () => {
    expect(true).toBe(true);
  });
});

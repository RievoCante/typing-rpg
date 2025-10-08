// Unit tests for XP calculation system
import { describe, it, expect } from "vitest";
import { calculateXpDelta, xpToNextLevel, applyXp } from "./xp";

describe("calculateXpDelta", () => {
  describe("Endless mode", () => {
    it("should give full XP for perfect typing (0 mistakes, 60 WPM)", () => {
      const xp = calculateXpDelta("endless", 0, 60);
      expect(xp).toBe(100); // base 100 * 1.0 WPM multiplier
    });

    it("should apply 0.8x penalty for 1-2 mistakes", () => {
      const xp = calculateXpDelta("endless", 1, 60);
      expect(xp).toBe(80); // 100 * 0.8 * 1.0
    });

    it("should apply 0.6x penalty for 3-4 mistakes", () => {
      const xp = calculateXpDelta("endless", 3, 60);
      expect(xp).toBe(60); // 100 * 0.6 * 1.0
    });

    it("should give 0 XP for 9+ mistakes", () => {
      const xp = calculateXpDelta("endless", 9, 60);
      expect(xp).toBe(0);
    });

    it("should apply WPM multiplier (120 WPM = 1.25x cap)", () => {
      const xp = calculateXpDelta("endless", 0, 120);
      expect(xp).toBe(125); // 100 * 1.25 (capped)
    });

    it("should apply WPM floor (30 WPM = 0.5x floor)", () => {
      const xp = calculateXpDelta("endless", 0, 30);
      expect(xp).toBe(50); // 100 * 0.5 (floored)
    });
  });

  describe("Daily mode", () => {
    it("should give base 500 XP with no step penalties", () => {
      const xp = calculateXpDelta("daily", 5, 60); // 5 mistakes should NOT reduce XP
      expect(xp).toBe(500); // base 500 * 1.0 WPM
    });

    it("should apply WPM multiplier (90 WPM = 1.5x)", () => {
      const xp = calculateXpDelta("daily", 0, 90);
      expect(xp).toBe(750); // 500 * 1.5
    });

    it("should cap WPM multiplier at 1.5x", () => {
      const xp = calculateXpDelta("daily", 0, 200);
      expect(xp).toBe(750); // 500 * 1.5 (capped)
    });
  });
});

describe("xpToNextLevel", () => {
  it("should require 20 XP to reach level 2", () => {
    expect(xpToNextLevel(1)).toBe(20);
  });

  it("should scale by 1.2x each level", () => {
    expect(xpToNextLevel(2)).toBe(24); // 20 * 1.2
    expect(xpToNextLevel(3)).toBe(29); // 24 * 1.2 (ceiled)
  });

  it("should handle high levels", () => {
    const lvl10 = xpToNextLevel(10);
    expect(lvl10).toBeGreaterThan(100);
  });
});

describe("applyXp", () => {
  it("should add XP without leveling up", () => {
    const result = applyXp(1, 10, 5);
    expect(result).toEqual({ level: 1, xp: 15 });
  });

  it("should level up when reaching threshold", () => {
    const result = applyXp(1, 15, 10); // 15 + 10 = 25, need 20 for lvl 2
    expect(result).toEqual({ level: 2, xp: 5 }); // leveled up, 5 XP leftover
  });

  it("should level up multiple times with large XP gain", () => {
    const result = applyXp(1, 0, 100); // Massive XP gain
    expect(result.level).toBeGreaterThan(2);
    expect(result.xp).toBeGreaterThanOrEqual(0);
  });

  it("should handle exact XP to level up", () => {
    const result = applyXp(1, 0, 20); // Exactly 20 XP
    expect(result).toEqual({ level: 2, xp: 0 });
  });
});

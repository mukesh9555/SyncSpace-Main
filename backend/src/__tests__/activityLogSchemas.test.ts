import { describe, it, expect } from "vitest";
import { activityQuerySchema } from "../lib/activityLogSchemas.js";

describe("activityQuerySchema", () => {
  it("accepts empty query (defaults applied)", () => {
    const result = activityQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.action).toBeUndefined();
      expect(result.data.entityType).toBeUndefined();
      expect(result.data.userId).toBeUndefined();
    }
  });

  it("accepts valid page and limit", () => {
    const result = activityQuerySchema.safeParse({ page: "3", limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(50);
    }
  });

  it("accepts valid filters", () => {
    const result = activityQuerySchema.safeParse({
      action: "note.created",
      entityType: "note",
      userId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects page less than 1", () => {
    const result = activityQuerySchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects negative page", () => {
    const result = activityQuerySchema.safeParse({ page: "-1" });
    expect(result.success).toBe(false);
  });

  it("rejects limit greater than 100", () => {
    const result = activityQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("rejects limit less than 1", () => {
    const result = activityQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("accepts limit of 100 (max)", () => {
    const result = activityQuerySchema.safeParse({ limit: "100" });
    expect(result.success).toBe(true);
  });

  it("accepts limit of 1 (min)", () => {
    const result = activityQuerySchema.safeParse({ limit: "1" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid userId format", () => {
    const result = activityQuerySchema.safeParse({
      userId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid userId UUID", () => {
    const result = activityQuerySchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("ignores unknown query parameters", () => {
    const result = activityQuerySchema.safeParse({
      page: "1",
      unknownField: "value",
    });
    expect(result.success).toBe(true);
  });

  it("coerces string numbers to integers", () => {
    const result = activityQuerySchema.safeParse({ page: "5", limit: "10" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.page).toBe("number");
      expect(typeof result.data.limit).toBe("number");
    }
  });
});

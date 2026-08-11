import { describe, expect, it } from "vitest";

const { GET } = await import("../health/route");

describe("GET /api/health", () => {
  it("returns 200 with a simple status payload", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

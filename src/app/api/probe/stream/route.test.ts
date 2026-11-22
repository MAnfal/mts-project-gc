import { describe, expect, it } from "vitest";
import { GET, maxDuration } from "./route";
import { DEFAULT_SECONDS, MAX_SECONDS, MIN_SECONDS, parseSeconds } from "./seconds";

describe("probe seconds clamp", () => {
  it.each([
    ["0", MIN_SECONDS],
    ["-3", MIN_SECONDS],
    ["500", MAX_SECONDS],
    ["abc", DEFAULT_SECONDS],
    ["", DEFAULT_SECONDS],
    [null, DEFAULT_SECONDS],
    ["2.7", 2],
    ["90", 90],
  ])("seconds=%s becomes %i", (input, expected) => {
    expect(parseSeconds(input)).toBe(expected);
  });

  it("keeps every clamped value inside 1–120", () => {
    expect([MIN_SECONDS, DEFAULT_SECONDS, MAX_SECONDS]).toEqual([1, 5, 120]);
  });
});

describe("GET /api/probe/stream", () => {
  it("declares the 300 s function budget", () => {
    expect(maxDuration).toBe(300);
  });

  it("streams one tick line per second, then done", async () => {
    const res = await GET(new Request("http://localhost/api/probe/stream?seconds=1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
    const body = await res.text();
    expect(body).toBe("tick 1\ndone\n");
  });
});

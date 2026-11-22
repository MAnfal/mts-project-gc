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
    ["Infinity", DEFAULT_SECONDS],
    ["-Infinity", DEFAULT_SECONDS],
    ["1e999", DEFAULT_SECONDS],
  ])("seconds=%s becomes %i", (input, expected) => {
    expect(parseSeconds(input)).toBe(expected);
  });

  it("returns a whole number in 1–120 for any input", () => {
    const inputs = [null, "", " ", "abc", "NaN", "Infinity", "-1e9", "1e9", "0.4", "119.9", "120", "121", "-0", "0x10", "1e2"];
    for (let n = -5; n <= 130; n += 7) inputs.push(String(n));
    for (const raw of inputs) {
      const s = parseSeconds(raw);
      expect(Number.isInteger(s), `seconds=${raw} -> ${s}`).toBe(true);
      expect(s, `seconds=${raw}`).toBeGreaterThanOrEqual(1);
      expect(s, `seconds=${raw}`).toBeLessThanOrEqual(120);
    }
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

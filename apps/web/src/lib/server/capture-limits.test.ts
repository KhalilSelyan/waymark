import { describe, expect, it } from "vitest";
import { acceptsCaptureResponse, maxCaptureBytes } from "./capture-limits";

describe("capture response limits", () => {
  it("accepts responses within the aggregate limit", () => expect(acceptsCaptureResponse(100, 200, 200)).toBe(true));
  it("rejects a declared oversized response before buffering", () => expect(acceptsCaptureResponse(0, maxCaptureBytes + 1, 0)).toBe(false));
  it("rejects chunked bodies when actual bytes exceed the limit", () => expect(acceptsCaptureResponse(maxCaptureBytes - 10, 0, 11)).toBe(false));
  it("rejects declared aggregate overflow", () => expect(acceptsCaptureResponse(maxCaptureBytes - 10, 11, 0)).toBe(false));
});

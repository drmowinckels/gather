import { describe, it, expect, vi, afterEach } from "vitest";
import { downloadText } from "./download";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("downloadText", () => {
  it("builds an object URL from the text and clicks an anchor to save it", () => {
    const created: Blob[] = [];
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((b: Blob) => {
        created.push(b);
        return "blob:mock";
      }),
      revokeObjectURL: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadText("data.csv", "a,b\r\n", "text/csv");

    expect(created).toHaveLength(1);
    expect(created[0].type).toBe("text/csv");
    expect(click).toHaveBeenCalledOnce();
    // the anchor is cleaned up after the click
    expect(document.querySelector("a[download]")).toBeNull();
  });
});

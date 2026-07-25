import { describe, expect, it } from "vitest";

import { staticContentType } from "./static-content-type.js";

describe("staticContentType", () => {
  it("serves MP4 walkthroughs as binary video", () => {
    expect(staticContentType("videos/zo-drive-v3-final.mp4")).toBe("video/mp4");
  });
});

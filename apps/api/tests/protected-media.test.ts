process.env.FILE_ENCRYPTION_KEY = "test-file-encryption-key-that-is-long-enough-123";

// The API test runtime transpiles modules to CommonJS, so require keeps the
// configuration load deterministic without needing Node's experimental VM mode.
const { decryptProtectedImage, protectImageInput } = require("../src/lib/protected-media") as typeof import("../src/lib/protected-media");

describe("protected rider media", () => {
  const tinyPng = "data:image/png;base64,iVBORw0KGgo=";

  it("encrypts evidence and restores it only with the configured key", () => {
    const stored = protectImageInput(tinyPng);

    expect(stored).toMatch(/^enc:v1:/);
    expect(stored).not.toContain("iVBORw0KGgo");
    expect(decryptProtectedImage(stored)).toBe(tinyPng);
  });

  it("rejects non-image content that pretends to be evidence", () => {
    expect(() => protectImageInput("data:image/png;base64,aW52YWxpZA==")).toThrow("evidencia");
  });
});

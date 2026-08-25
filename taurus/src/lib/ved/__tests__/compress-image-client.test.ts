import { describe, expect, it } from "vitest";
import {
  compressTargetDimensions,
  shouldCompressImage,
  UPLOAD_IMAGE_MIN_BYTES,
} from "../compress-image-client";

describe("compress-image-client", () => {
  it("skips non-images and gif/svg", () => {
    expect(shouldCompressImage({ type: "application/pdf", size: 2e6 })).toBe(false);
    expect(shouldCompressImage({ type: "image/gif", size: 2e6 })).toBe(false);
    expect(shouldCompressImage({ type: "image/svg+xml", size: 2e6 })).toBe(false);
  });

  it("compresses large jpeg/png/webp only over threshold", () => {
    expect(shouldCompressImage({ type: "image/jpeg", size: UPLOAD_IMAGE_MIN_BYTES - 1 })).toBe(
      false
    );
    expect(shouldCompressImage({ type: "image/jpeg", size: UPLOAD_IMAGE_MIN_BYTES + 1 })).toBe(
      true
    );
    expect(shouldCompressImage({ type: "image/png", size: 1e6 })).toBe(true);
    expect(shouldCompressImage({ type: "image/webp", size: 1e6 })).toBe(true);
  });

  it("scales long edge to max", () => {
    expect(compressTargetDimensions(3200, 2000, 1600)).toEqual({ w: 1600, h: 1000 });
    expect(compressTargetDimensions(800, 600, 1600)).toEqual({ w: 800, h: 600 });
  });
});

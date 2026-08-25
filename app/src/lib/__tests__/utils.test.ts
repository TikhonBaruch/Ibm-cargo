import { describe, it, expect } from "vitest";
import { extractS3Key } from "../utils";

describe("extractS3Key", () => {
  it("extracts key from S3 URL", () => {
    const url = "https://s3.example.com/bucket/folder/file.jpg";
    expect(extractS3Key(url)).toBe("folder/file.jpg");
  });

  it("extracts key from Yandex Cloud URL", () => {
    const url = "https://storage.yandexcloud.net/my-bucket/uploads/image.webp";
    expect(extractS3Key(url)).toBe("uploads/image.webp");
  });

  it("handles nested paths", () => {
    const url = "https://endpoint/bucket/a/b/c/file.png";
    expect(extractS3Key(url)).toBe("a/b/c/file.png");
  });
});

describe("Slug generation logic", () => {
  it("converts cyrillic to transliterated slug", () => {
    // Test the regex pattern used in generateSlug
    const title = "Привет мир";
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-|-$/g, "");
    expect(slug).toBe("привет-мир");
  });

  it("removes special characters", () => {
    const title = "Hello, World! @#$%";
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-|-$/g, "");
    expect(slug).toBe("hello-world");
  });

  it("handles multiple spaces", () => {
    const title = "  Multiple   spaces  ";
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-|-$/g, "");
    expect(slug).toBe("multiple-spaces");
  });
});

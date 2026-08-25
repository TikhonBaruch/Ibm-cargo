import { NextResponse } from "next/server";
import {
  s3Configured,
  uploadToS3,
  generateFileKey,
} from "@/lib/s3";
import { processImage, isImageFile } from "@/lib/image-processing";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { logUpload } from "@/lib/audit";
import { PLATFORM_ROLES, requireRole } from "@/lib/require-role";

export async function POST(req: Request) {
  const { session, error } = await requireRole([...PLATFORM_ROLES, "SPECIALIST"]);
  if (error) return error;
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = ((formData.get("folder") as string) || "uploads")
      .replace(/[^a-zA-Z0-9_-]/g, "")  // Sanitize: only allow alphanumeric, dash, underscore
      .replace(/\.\./g, "");           // Remove path traversal
    const maxWidth = parseInt(formData.get("maxWidth") as string) || 1920;
    const maxHeight = parseInt(formData.get("maxHeight") as string) || 1080;
    const quality = parseInt(formData.get("quality") as string) || 80;
    const reducePercent = parseInt(formData.get("reducePercent") as string) || 30;

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);
    let contentType = file.type || "application/octet-stream";
    let extension = file.name.split(".").pop() || "bin";

    // Process image if it's an image file
    if (isImageFile(file.name)) {
      const processed = await processImage(buffer, {
        maxWidth,
        maxHeight,
        quality,
        format: "webp",
        reducePercent,
      });
      buffer = Buffer.from(processed.buffer);
      contentType = processed.contentType;
      extension = processed.extension;
    }

    // Upload to S3 if configured, otherwise local filesystem
    if (s3Configured) {
      const key = generateFileKey(folder, `${file.name.split(".")[0]}.${extension}`);
      const url = await uploadToS3(key, buffer, contentType);
      logUpload(
        (session.user as any)?.id || "",
        session.user?.name || "User",
        (session.user as any)?.role || "USER",
        file.name,
        folder
      );
      return NextResponse.json({
        url,
        filename: `${file.name.split(".")[0]}.${extension}`,
        storage: "s3",
        processed: isImageFile(file.name),
      });
    }

    // Local filesystem fallback
    const filename = `${crypto.randomUUID()}.${extension}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);

    const url = `/uploads/${folder}/${filename}`;
    logUpload(
      (session.user as any)?.id || "",
      session.user?.name || "User",
      (session.user as any)?.role || "USER",
      file.name,
      folder
    );
    return NextResponse.json({
      url,
      filename,
      storage: "local",
      processed: isImageFile(file.name),
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

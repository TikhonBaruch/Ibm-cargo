/**
 * Serve local VED uploads in dev / Docker (no S3). Standalone Next does not
 * expose runtime files under public/ — this route reads from disk.
 */
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ filename: string }> }
) {
  if (process.env.VERCEL && !process.env.ALLOW_LOCAL_UPLOADS) {
    return NextResponse.json({ error: "Use S3 on Vercel" }, { status: 503 });
  }

  const { filename } = await ctx.params;
  if (!/^[a-f0-9-]{36}\.[a-z0-9]+$/i.test(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "public", "uploads", "ved", filename);
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buf = await readFile(filePath);
  const ext = filename.split(".").pop()?.toLowerCase() || "bin";
  return new NextResponse(buf, {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

/**
 * VED document upload for client/broker cabinets (branch 1).
 * S3 when S3_* configured (Vercel-durable); else public/uploads/ved.
 */
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { s3Configured, uploadToS3, generateFileKey } from "@/lib/s3";
import { requireRole, DOMAIN_ROLES } from "@/lib/require-role";

/** Client/broker document upload for VED (local or S3). */
export async function POST(req: Request) {
  const { session, error } = await requireRole(DOMAIN_ROLES);
  if (error) return error;
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const maxBytes = Number(process.env.UPLOAD_MAX_BYTES || 12 * 1024 * 1024);
    // Check declared size before buffering — a 40MB camera file OOMs the isolate
    // (empty runtime log + Vercel Request ID page) if we arrayBuffer first.
    if (typeof file.size === "number" && file.size > maxBytes) {
      return NextResponse.json(
        { error: `File too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)` },
        { status: 413 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const extension = (file.name.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "") || "bin";
    const contentType = file.type || "application/octet-stream";
    if (buffer.length > maxBytes) {
      return NextResponse.json(
        { error: `File too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)` },
        { status: 413 }
      );
    }
    const allowed = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/i;
    if (contentType && contentType !== "application/octet-stream" && !allowed.test(contentType)) {
      return NextResponse.json(
        { error: "Only images (jpeg/png/webp/gif) or PDF allowed" },
        { status: 415 }
      );
    }

    if (s3Configured) {
      const key = generateFileKey("ved", `${file.name.split(".")[0]}.${extension}`);
      const url = await uploadToS3(key, buffer, contentType);
      return NextResponse.json({
        url,
        filename: file.name,
        storage: "s3",
      });
    }

    // Vercel FS is read-only — local fallback only works in local/dev.
    if (process.env.VERCEL) {
      return NextResponse.json(
        {
          error:
            "S3 not configured. Set S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY on Vercel.",
        },
        { status: 503 }
      );
    }

    const filename = `${crypto.randomUUID()}.${extension}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "ved");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }
    await writeFile(path.join(uploadDir, filename), buffer);
    const url = `/uploads/ved/${filename}`;
    return NextResponse.json({
      url,
      filename: file.name,
      storage: "local",
    });
  } catch (e) {
    console.error("[uploads]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}

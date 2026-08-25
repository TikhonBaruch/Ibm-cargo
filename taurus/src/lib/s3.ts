import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET;
const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION || "ru-central1";
const accessKeyId = process.env.S3_ACCESS_KEY;
const secretAccessKey = process.env.S3_SECRET_KEY;

export const s3Configured = !!(bucket && endpoint && accessKeyId && secretAccessKey);

function getClient(): S3Client {
  if (!s3Configured) {
    throw new Error("S3 not configured. Set S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY");
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
    forcePathStyle: true,
  });
}

export function getS3BaseUrl(): string {
  return `${endpoint}/${bucket}`;
}

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Public URL in mediaUrl for <img> in cabinets; set S3_OBJECT_ACL=public-read when bucket allows ACLs.
      ...(process.env.S3_OBJECT_ACL
        ? { ACL: process.env.S3_OBJECT_ACL as "private" | "public-read" }
        : {}),
    })
  );

  return `${getS3BaseUrl()}/${key}`;
}

export async function deleteFromS3(key: string): Promise<void> {
  const client = getClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

export function generateFileKey(folder: string, filename: string): string {
  const ext = filename.split(".").pop() || "bin";
  const uuid = crypto.randomUUID();
  return `${folder}/${uuid}.${ext}`;
}

import sharp from "sharp";

export interface ImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: "jpeg" | "png" | "webp" | "avif";
  reducePercent?: number;
}

const DEFAULT_OPTIONS: ImageOptions = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 80,
  format: "webp",
  reducePercent: 30,
};

export async function processImage(
  buffer: Buffer,
  options?: ImageOptions
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const image = sharp(buffer);
  const metadata = await image.metadata();

  // Calculate reduced dimensions
  const factor = 1 - (opts.reducePercent || 0) / 100;
  const targetWidth = Math.round((opts.maxWidth || metadata.width!) * factor);
  const targetHeight = Math.round((opts.maxHeight || metadata.height!) * factor);

  // Resize if image is larger than target
  const needsResize =
    metadata.width! > targetWidth || metadata.height! > targetHeight;

  if (needsResize) {
    image.resize({
      width: targetWidth,
      height: targetHeight,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Convert format
  let contentType: string;
  let extension: string;

  switch (opts.format) {
    case "jpeg":
      image.jpeg({ quality: opts.quality });
      contentType = "image/jpeg";
      extension = "jpg";
      break;
    case "png":
      image.png({ quality: opts.quality });
      contentType = "image/png";
      extension = "png";
      break;
    case "avif":
      image.avif({ quality: opts.quality });
      contentType = "image/avif";
      extension = "avif";
      break;
    case "webp":
    default:
      image.webp({ quality: opts.quality });
      contentType = "image/webp";
      extension = "webp";
      break;
  }

  const processed = await image.toBuffer();

  return {
    buffer: processed,
    contentType,
    extension,
  };
}

export function isImageFile(filename: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|avif|tiff|bmp)$/i.test(filename);
}

// Utility for client-side image compression and format conversion to WebP
// Resize to maxWidth while keeping aspect ratio; convert to WebP with given quality

export interface CompressOptions {
  maxWidth?: number;
  quality?: number; // 0..1
  outputType?: 'image/webp' | 'image/jpeg' | 'image/png';
  fileName?: string;
}

const DEFAULT_OPTS: Required<Pick<CompressOptions, 'maxWidth' | 'quality' | 'outputType'>> = {
  maxWidth: 800,
  quality: 0.6,
  outputType: 'image/webp',
};

const isImageType = (type?: string) => !!type && type.startsWith('image/');

/**
 * Compress a File (image) to WebP with resize. Returns a new File.
 */
export const compressImageFile = async (file: File, options: CompressOptions = {}): Promise<File> => {
  if (!isImageType(file.type)) return file; // non-image: skip

  const { maxWidth, quality, outputType } = { ...DEFAULT_OPTS, ...options };
  const bitmap = await createImageBitmap(file);

  const ratio = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
  const targetWidth = Math.round(bitmap.width * ratio);
  const targetHeight = Math.round(bitmap.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, outputType, quality));
  if (!blob) return file;

  const name = options.fileName || file.name.replace(/\.[^.]+$/, '') + '.webp';
  return new File([blob], name, { type: outputType });
};

/**
 * Compress a Blob (image) to WebP with resize. Returns a Blob.
 */
export const compressBlobToWebP = async (blob: Blob, options: CompressOptions = {}): Promise<Blob> => {
  if (!isImageType(blob.type)) return blob;
  const { maxWidth, quality, outputType } = { ...DEFAULT_OPTS, ...options };
  const bitmap = await createImageBitmap(blob);

  const ratio = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
  const targetWidth = Math.round(bitmap.width * ratio);
  const targetHeight = Math.round(bitmap.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  const out: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, outputType, quality));
  return out || blob;
};

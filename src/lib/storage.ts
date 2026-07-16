import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';

// ── Types ──────────────────────────────────────────────────────────────────

export type UploadOptions = {
  folder?: string;
  contentType?: string;
  maxSizeBytes?: number;
};

export type UploadResult = {
  url: string;
  provider: 'supabase' | 'cloudinary';
  path: string;
};

// ── Supabase Provider ──────────────────────────────────────────────────────

const BUCKET = 'product-images';

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set when STORAGE_PROVIDER is "supabase"',
    );
  }
  return createClient(url, key);
}

async function uploadToSupabase(
  file: Buffer,
  path: string,
  options: UploadOptions,
): Promise<UploadResult> {
  const client = getSupabaseClient();
  const storagePath = `${path}-${Date.now()}`;

  const uploadOptions: { upsert: boolean; contentType?: string } = { upsert: false };
  if (options.contentType) {
    uploadOptions.contentType = options.contentType;
  }

  const { error } = await client.storage
    .from(BUCKET)
    .upload(storagePath, file, uploadOptions);

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = client.storage.from(BUCKET).getPublicUrl(storagePath);

  return { url: publicUrl, provider: 'supabase', path: storagePath };
}

// ── Cloudinary Provider ────────────────────────────────────────────────────

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must be set when STORAGE_PROVIDER is "cloudinary"',
    );
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

async function uploadToCloudinary(
  file: Buffer,
  path: string,
  options: UploadOptions,
): Promise<UploadResult> {
  configureCloudinary();

  const publicId = `${path}-${Date.now()}`;

  const result = await new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const uploadOpts: Record<string, unknown> = {
        public_id: publicId,
        format: 'webp',
        quality: 'auto:good',
      };
      if (options.folder) {
        uploadOpts.folder = options.folder;
      }
      const stream = cloudinary.uploader.upload_stream(
        uploadOpts,
        (error, result) => {
          if (error || !result) {
            reject(new Error(`Cloudinary upload failed: ${error?.message ?? 'Unknown error'}`));
            return;
          }
          resolve(result);
        },
      );
      stream.end(file);
    },
  );

  return {
    url: result.secure_url,
    provider: 'cloudinary',
    path: result.public_id,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function uploadFile(
  file: Buffer,
  path: string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const provider = process.env.STORAGE_PROVIDER;

  if (provider !== 'supabase' && provider !== 'cloudinary') {
    throw new Error("STORAGE_PROVIDER must be set to 'supabase' or 'cloudinary'");
  }

  if (options.maxSizeBytes && file.length > options.maxSizeBytes) {
    throw new Error(
      `File size ${file.length} bytes exceeds maximum allowed size of ${options.maxSizeBytes} bytes`,
    );
  }

  if (provider === 'supabase') {
    return uploadToSupabase(file, path, options);
  }

  return uploadToCloudinary(file, path, options);
}

export async function deleteFile(
  path: string,
  provider?: string,
): Promise<void> {
  const resolvedProvider = provider ?? process.env.STORAGE_PROVIDER;

  try {
    if (resolvedProvider === 'supabase') {
      const client = getSupabaseClient();
      await client.storage.from(BUCKET).remove([path]);
    } else if (resolvedProvider === 'cloudinary') {
      configureCloudinary();
      await cloudinary.uploader.destroy(path);
    }
  } catch (error) {
    console.warn(
      `Failed to delete file "${path}" from ${resolvedProvider}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

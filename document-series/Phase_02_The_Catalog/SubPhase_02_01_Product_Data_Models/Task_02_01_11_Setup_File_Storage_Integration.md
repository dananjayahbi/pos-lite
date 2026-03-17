# Task 02.01.11 — Setup File Storage Integration

## Metadata

| Property             | Value                                         |
| -------------------- | --------------------------------------------- |
| Sub-Phase            | 02.01 — Product & Variant Data Models         |
| Phase                | 02 — The Catalog                              |
| Estimated Complexity | Medium                                        |
| Dependencies         | None — this task can run in parallel with any other task in this sub-phase |

---

## Objective

Create src/lib/storage.ts, a unified file upload abstraction that routes uploads to either Supabase Storage or Cloudinary based on the STORAGE_PROVIDER environment variable, and expose a deleteFile function for removing images during variant updates.

---

## Instructions

### Step 1: Install Required Packages

Install the Supabase JavaScript client by running pnpm add @supabase/supabase-js. Install the Cloudinary SDK by running pnpm add cloudinary. Both packages are required even if only one provider is actively configured, because any team member may switch providers and the build must not fail due to a missing package.

### Step 2: Define the UploadOptions and UploadResult Types

Create the file src/lib/storage.ts. At the top of the file, define and export two TypeScript types:

The UploadOptions type has optional fields: folder (string — a path prefix within the storage bucket or Cloudinary folder to organise uploads), contentType (string — the MIME type of the file, for example image/webp or image/jpeg), maxSizeBytes (number — if provided, the upload will be rejected before sending to the provider if the buffer size exceeds this limit).

The UploadResult type has: url (string — the public URL of the uploaded file), provider (string — either "supabase" or "cloudinary", useful for logging and debugging), path (string — the full storage path used, useful for constructing the deleteFile call later).

### Step 3: Implement the Supabase Storage Provider

Implement a non-exported internal function named uploadToSupabase that accepts a Buffer, a path string, and an UploadOptions object. This function:

Creates a Supabase client using the createClient function from @supabase/supabase-js, passing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment. The service role key is used here (not the public anon key) because this is a server-side upload function and the product-images bucket should not permit unauthenticated uploads via public anon keys. Accessing the service role key from environment variables in this server-only module is safe because this file will never be imported in a client component.

Generates a deterministic unique path by combining the provided path argument, a forward slash, and a timestamp suffix in milliseconds. For example, if the path argument is "products/variant-abc123/main", the resulting storage path might be "products/variant-abc123/main-1710520800000". This prevents collisions when an image for the same variant position is uploaded multiple times (during re-uploads).

Calls supabaseClient.storage.from("product-images").upload() with the constructed path and the buffer, setting the contentType from options and upsert to false to avoid silently overwriting files.

If the upload returns an error from Supabase, throws a descriptive error including the Supabase error message.

Constructs and returns the public URL by calling supabaseClient.storage.from("product-images").getPublicUrl() with the same path, and returns an UploadResult with the url, provider "supabase", and the path.

### Step 4: Implement the Cloudinary Provider

Implement a non-exported internal function named uploadToCloudinary that accepts a Buffer, a path string, and an UploadOptions object. This function:

Configures the Cloudinary client using the v2 API by setting cloud_name from CLOUDINARY_CLOUD_NAME, api_key from CLOUDINARY_API_KEY, and api_secret from CLOUDINARY_API_SECRET.

Uploads using cloudinary.v2.uploader.upload_stream or cloudinary.v2.uploader.upload, wrapping the Buffer in a data URI or using the buffer upload method. The upload should set the public_id to the provided path plus a timestamp suffix (matching the same pattern used for Supabase). Set the folder option if a folder is specified in UploadOptions. Set format to "webp" and the quality parameter to "auto:good" to take advantage of Cloudinary's native WebP conversion and quality optimisation.

If the upload fails, throw a descriptive error including the Cloudinary error message.

Return an UploadResult with the secure_url from Cloudinary's response as the url, provider "cloudinary", and the public_id as the path.

### Step 5: Implement the Exported uploadFile Function

Implement and export the main uploadFile function with the signature: uploadFile(file: Buffer, path: string, options?: UploadOptions): Promise<UploadResult>.

At the start of the function, read process.env.STORAGE_PROVIDER. If the value is not "supabase" and not "cloudinary", throw a configuration error with the message "STORAGE_PROVIDER must be set to 'supabase' or 'cloudinary'". This check prevents silent failures when the environment variable is misconfigured.

If maxSizeBytes is set in options, compare file.length to maxSizeBytes and throw a validation error if the file exceeds the limit — this check is done before any network call to save provider API costs on rejected uploads.

Delegate to either uploadToSupabase or uploadToCloudinary based on the STORAGE_PROVIDER value.

### Step 6: Implement the Exported deleteFile Function

Implement and export a deleteFile function with the signature: deleteFile(path: string, provider?: string): Promise<void>.

The provider parameter defaults to reading STORAGE_PROVIDER from the environment if not explicitly passed. The function checks the provider and calls the appropriate deletion API:

For Supabase: call supabaseClient.storage.from("product-images").remove([path]).

For Cloudinary: call cloudinary.v2.uploader.destroy(path) using the public_id stored as path.

If deletion fails, log a warning to the server console but do not throw — a deletion failure should not prevent the update operation that triggered it from succeeding. The file may linger in storage but will be orphaned and can be cleaned up in a maintenance job.

### Step 7: Add Environment Variable Documentation

Add a companion entry in the project's .env.example file (not .env — never commit real credentials) documenting the following variables: STORAGE_PROVIDER, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET. Add comments next to each variable explaining its purpose and where to find it (Supabase project settings, Cloudinary dashboard).

### Step 8: Configure the Product Images Bucket

If using Supabase Storage, log into the Supabase dashboard for the project and create a storage bucket named "product-images". Set the bucket visibility to public (so image URLs can be used in img tags without authentication). Configure the maximum allowed file size in the bucket policy to 5MB. This step cannot be automated from the codebase and must be done manually by the developer configuring the environment.

---

## Expected Output

- src/lib/storage.ts exports uploadFile and deleteFile functions
- UploadResult and UploadOptions TypeScript types are exported
- uploadFile correctly routes to the configured provider
- deleteFile silently swallows errors and logs a warning
- The file never imports or uses any client-side APIs — it is strictly server-side
- .env.example has documentation entries for all six storage-related environment variables

---

## Validation

- [ ] uploadFile with STORAGE_PROVIDER not set throws a configuration error
- [ ] uploadFile with a Buffer exceeding maxSizeBytes throws before making any network call
- [ ] A test upload to Supabase Storage returns a public URL accessible in a browser
- [ ] A test upload to Cloudinary returns a secure HTTPS URL with WebP format
- [ ] deleteFile does not throw when the deletion fails — it only logs a warning
- [ ] pnpm tsc --noEmit passes with no type errors in storage.ts

---

## Notes

The choice between Supabase Storage and Cloudinary has practical trade-offs relevant to the VelvetPOS deployment context in Sri Lanka. Supabase Storage is simpler from an infrastructure standpoint if the project is already using Supabase for its database (though the current stack uses Prisma with plain PostgreSQL). Cloudinary provides built-in image transformation, resizing, and WebP conversion as part of its CDN, which reduces server-side image processing responsibility. Either provider is acceptable for this version of VelvetPOS because the file is small (product images typically under 2MB) and transformation is not required at upload time.

The Buffer approach (rather than streams or File objects) is chosen because Next.js App Router Route Handlers that receive FormData must convert uploaded file blobs to ArrayBuffer and then to Buffer before the upload function can be called. This conversion is the calling code's responsibility — the uploadFile function receives a ready Buffer. This allows the storage module to be tested independently of the HTTP layer by passing test Buffers directly.

In the future, image variant thumbnails (resized versions for the POS grid display) can be generated as a post-upload step using Cloudinary's URL-based transformation API or Supabase's image resizing feature. This does not require changes to the storage module's interface.

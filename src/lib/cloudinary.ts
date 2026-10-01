import { createHash } from "crypto";
import { ApiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

/**
 * Image storage on Cloudinary.
 *
 * Files are uploaded through our own API (never straight from the browser),
 * so the server checks the type, size and tenant before anything is stored.
 * Every image lives under `dineflow/<restaurantId>/<kind>/`, which is how we
 * tell whether a URL belongs to a tenant when it is saved or deleted.
 */

export const IMAGE_KINDS = ["logo", "branch", "menu"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

/** Upper limit after the browser has resized the photo; Vercel caps bodies at 4.5 MB. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Longest edge we keep; larger uploads are scaled down by Cloudinary. */
const MAX_DIMENSION = 2000;

const ROOT_FOLDER = "dineflow";

function credentials() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function isCloudinaryConfigured() {
  return credentials() !== null;
}

/** Cloudinary's request signature: sorted `key=value` pairs + secret, SHA-1. */
export function signParams(
  params: Record<string, string | number>,
  apiSecret: string
) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(payload + apiSecret).digest("hex");
}

/** Sniffs the real format from the file's first bytes; the browser's MIME type is not trusted. */
export function detectImageType(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function tenantFolder(restaurantId: string, kind: ImageKind) {
  return `${ROOT_FOLDER}/${restaurantId}/${kind}`;
}

/**
 * The public id of an image stored in our Cloudinary account, or null for
 * any other URL. Only plain delivery URLs (as returned by an upload) count;
 * transformed URLs are never stored.
 */
export function cloudinaryPublicId(url: string, cloudName = process.env.CLOUDINARY_CLOUD_NAME) {
  if (!cloudName) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") {
    return null;
  }

  // Our public ids are plain; anything percent-encoded (e.g. %2F) could
  // smuggle extra path segments past the tenant-folder check.
  if (parsed.pathname.includes("%") || parsed.search) return null;

  const [cloud, resource, delivery, ...rest] = parsed.pathname.split("/").filter(Boolean);
  if (cloud !== cloudName || resource !== "image" || delivery !== "upload") return null;
  if (rest[0] && /^v\d+$/.test(rest[0])) rest.shift();
  if (rest.length < 2) return null;

  return rest.join("/").replace(/\.[a-z0-9]+$/i, "");
}

/** True when `url` is an image this restaurant uploaded. */
export function isTenantImage(url: string, restaurantId: string) {
  const publicId = cloudinaryPublicId(url);
  return !!publicId && publicId.startsWith(`${ROOT_FOLDER}/${restaurantId}/`);
}

/**
 * Rejects image URLs that were not uploaded by this restaurant, so a tenant
 * cannot point its menu at another tenant's files or an arbitrary host.
 * An unchanged value is always accepted (older records may predate uploads).
 */
export function assertTenantImage(
  url: string | undefined,
  restaurantId: string,
  current?: string | null
) {
  if (!url || url === current) return;
  if (!isTenantImage(url, restaurantId)) {
    throw new ApiError("Upload the image with the upload button", 422);
  }
}

export interface UploadedImage {
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export async function uploadImage(
  file: Blob,
  options: { restaurantId: string; kind: ImageKind }
): Promise<UploadedImage> {
  const creds = credentials();
  if (!creds) throw new ApiError("Image uploads are not set up on this server", 503);

  const params = {
    folder: tenantFolder(options.restaurantId, options.kind),
    timestamp: Math.floor(Date.now() / 1000),
    transformation: `c_limit,w_${MAX_DIMENSION},h_${MAX_DIMENSION}`,
  };

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", creds.apiKey);
  for (const [key, value] of Object.entries(params)) form.append(key, String(value));
  form.append("signature", signParams(params, creds.apiSecret));

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${creds.cloudName}/image/upload`,
      { method: "POST", body: form }
    );
  } catch (error) {
    logger.error("Cloudinary upload request failed", { error });
    throw new ApiError("Could not upload the image. Please try again.", 502);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.secure_url) {
    logger.error("Cloudinary rejected upload", {
      status: response.status,
      error: body?.error?.message,
    });
    throw new ApiError("Could not upload the image. Please try again.", 502);
  }

  return {
    url: body.secure_url,
    width: body.width,
    height: body.height,
    bytes: body.bytes,
  };
}

/**
 * Removes an image from Cloudinary. Best effort: a failure is logged and
 * never fails the request that triggered it, since the record is already
 * saved. URLs outside our account are ignored.
 */
export async function deleteImage(url: string | null | undefined) {
  const creds = credentials();
  const publicId = url ? cloudinaryPublicId(url) : null;
  if (!creds || !publicId) return false;

  const params = {
    invalidate: "true",
    public_id: publicId,
    timestamp: Math.floor(Date.now() / 1000),
  };
  const form = new FormData();
  form.append("api_key", creds.apiKey);
  for (const [key, value] of Object.entries(params)) form.append(key, String(value));
  form.append("signature", signParams(params, creds.apiSecret));

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${creds.cloudName}/image/destroy`,
      { method: "POST", body: form }
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || (body?.result !== "ok" && body?.result !== "not found")) {
      logger.warn("Cloudinary did not delete image", { publicId, result: body?.result });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("Cloudinary delete request failed", { publicId, error });
    return false;
  }
}

/** Deletes the old image after a record switched to a new one (or none). */
export async function deleteReplacedImage(
  previous: string | null | undefined,
  next: string | null | undefined,
  restaurantId: string
) {
  if (!previous || previous === next) return;
  if (!isTenantImage(previous, restaurantId)) return;
  await deleteImage(previous);
}

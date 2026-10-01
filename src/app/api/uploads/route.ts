import { NextRequest } from "next/server";
import { z } from "zod";
import { Branch, MenuItem, Restaurant } from "@/models";
import {
  ApiError,
  handleApiError,
  ok,
  parseBody,
  requireWriteSession,
  tenantFilter,
} from "@/lib/api-helpers";
import {
  IMAGE_KINDS,
  MAX_IMAGE_BYTES,
  deleteImage,
  detectImageType,
  isTenantImage,
  uploadImage,
  type ImageKind,
} from "@/lib/cloudinary";
import { rateLimit } from "@/lib/rate-limit";
import type { Role } from "@/lib/constants";

/** Who may upload each kind of image — the same roles that can save it. */
const UPLOAD_ROLES: Record<ImageKind, Role[]> = {
  logo: ["super_admin", "owner"],
  branch: ["super_admin", "owner", "manager"],
  menu: ["super_admin", "owner", "manager"],
};

/** Multipart form: `file` (JPEG, PNG or WebP) and `kind` (logo | branch | menu). */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireWriteSession(["super_admin", "owner", "manager"]);

    // Refuse oversized bodies before reading them into memory.
    const declared = Number(request.headers.get("content-length"));
    if (declared > MAX_IMAGE_BYTES + 64 * 1024) {
      throw new ApiError("Images must be 4 MB or smaller", 413);
    }

    const limit = rateLimit(`upload:${ctx.userId}`, 40, 10 * 60_000);
    if (!limit.allowed) {
      throw new ApiError("Too many uploads — please wait a few minutes", 429);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ApiError("Send the image as multipart form data", 400);
    }

    const kind = form.get("kind");
    if (typeof kind !== "string" || !IMAGE_KINDS.includes(kind as ImageKind)) {
      throw new ApiError("Unknown image kind", 400);
    }
    if (!UPLOAD_ROLES[kind as ImageKind].includes(ctx.role)) {
      throw new ApiError("Forbidden: insufficient permissions", 403);
    }

    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      throw new ApiError("Choose an image to upload", 400);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new ApiError("Images must be 4 MB or smaller", 413);
    }

    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!detectImageType(head)) {
      throw new ApiError("Only JPEG, PNG and WebP images are supported", 415);
    }

    const image = await uploadImage(file, {
      restaurantId: ctx.restaurantId,
      kind: kind as ImageKind,
    });
    return ok(image, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

const discardSchema = z.object({ url: z.string().url() });

/**
 * Discards an upload that was never saved (the form was cancelled or the
 * image replaced before saving). Images still used by a record are kept.
 */
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requireWriteSession(["super_admin", "owner", "manager"]);
    const { url } = await parseBody(request, discardSchema);

    if (!isTenantImage(url, ctx.restaurantId)) {
      throw new ApiError("Image not found", 404);
    }

    const tenant = tenantFilter(ctx);
    const [restaurant, branch, item] = await Promise.all([
      Restaurant.exists({ _id: tenant.restaurantId, logo: url }),
      Branch.exists({ ...tenant, image: url }),
      MenuItem.exists({ ...tenant, image: url }),
    ]);
    if (restaurant || branch || item) return ok({ deleted: false });

    return ok({ deleted: await deleteImage(url) });
  } catch (error) {
    return handleApiError(error);
  }
}

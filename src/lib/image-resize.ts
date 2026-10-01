/**
 * Browser-side image preparation before upload. Phone photos are often
 * 5–10 MB; scaling them down here keeps uploads fast on mobile data and
 * under the server's 4 MB limit.
 */

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Files already this small and within the size limit are sent untouched. */
const SMALL_FILE_BYTES = 1.5 * 1024 * 1024;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File, maxEdge = 1600): Promise<Blob> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP image");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Unreadable here; let the server give the definitive answer.
    return file;
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= SMALL_FILE_BYTES) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // WebP keeps transparency for logos; browsers that cannot encode it
  // hand back PNG, so fall back to JPEG for photos.
  let blob = await canvasToBlob(canvas, "image/webp", 0.85);
  if (blob?.type !== "image/webp" && file.type !== "image/png") {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
  }

  return blob && blob.size < file.size ? blob : file;
}

"use client";

import type { ComponentType } from "react";
import Image, { type ImageLoaderProps, type ImageProps } from "next/image";

const CLOUDINARY_PREFIX = "https://res.cloudinary.com/";
const UPLOAD_MARKER = "/image/upload/";

/**
 * Lets Cloudinary resize and pick the format (WebP/AVIF) per screen width,
 * instead of running every image through Next's own optimiser.
 */
export function cloudinaryLoader({ src, width, quality }: ImageLoaderProps) {
  const index = src.indexOf(UPLOAD_MARKER);
  if (!src.startsWith(CLOUDINARY_PREFIX) || index < 0) return src;
  const cut = index + UPLOAD_MARKER.length;
  return `${src.slice(0, cut)}f_auto,q_${quality ?? "auto"},c_limit,w_${width}/${src.slice(cut)}`;
}

/** next/image for uploaded photos; other URLs are shown as-is. */
export function CloudImage({ src, alt, ...props }: ImageProps & { src: string }) {
  const isCloudinary = src.startsWith(CLOUDINARY_PREFIX);
  return (
    <Image
      src={src}
      alt={alt}
      loader={isCloudinary ? cloudinaryLoader : undefined}
      unoptimized={!isCloudinary}
      {...props}
    />
  );
}

/** Small square preview for list rows, with an icon when there is no image. */
export function Thumbnail({
  src,
  alt,
  fallback: Fallback,
  className = "h-10 w-10",
}: {
  src?: string | null;
  alt: string;
  fallback: ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-md bg-muted ${className}`}
    >
      {src ? (
        <CloudImage src={src} alt={alt} fill sizes="80px" className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Fallback className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

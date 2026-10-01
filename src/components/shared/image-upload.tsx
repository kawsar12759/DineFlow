"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CloudImage } from "@/components/shared/cloud-image";
import { ACCEPTED_IMAGE_TYPES, prepareImage } from "@/lib/image-resize";
import { cn } from "@/lib/utils";

type ImageKind = "logo" | "branch" | "menu";

interface ImageUploadProps {
  kind: ImageKind;
  /** The saved or freshly uploaded image URL; empty for none. */
  value?: string;
  onChange: (url: string) => void;
  /** Square for logos, wide for cover photos. */
  shape?: "square" | "wide";
  disabled?: boolean;
  className?: string;
}

const MAX_EDGE: Record<ImageKind, number> = { logo: 800, branch: 1920, menu: 1600 };

/** Asks the server to drop an upload that never got saved; it keeps any image still in use. */
function discardUpload(url: string) {
  void fetch("/api/uploads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    keepalive: true,
  }).catch(() => undefined);
}

export function ImageUpload({
  kind,
  value,
  onChange,
  shape = "wide",
  disabled,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Uploads made in this form; any the user moves past are cleaned up.
  const freshUploads = useRef(new Set<string>());

  useEffect(() => {
    const uploads = freshUploads.current;
    return () => uploads.forEach(discardUpload);
  }, []);

  function replaceValue(next: string) {
    if (value && freshUploads.current.has(value)) {
      freshUploads.current.delete(value);
      discardUpload(value);
    }
    onChange(next);
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const prepared = await prepareImage(file, MAX_EDGE[kind]);
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", prepared, file.name);

      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(
          body?.error ??
            (response.status === 413
              ? "Images must be 4 MB or smaller"
              : "Could not upload the image")
        );
      }

      const url: string = body.data.url;
      freshUploads.current.add(url);
      replaceValue(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload the image");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function pick() {
    if (!disabled && !uploading) inputRef.current?.click();
  }

  const frame = cn(
    "relative overflow-hidden rounded-lg border bg-muted",
    shape === "square" ? "aspect-square w-28" : "aspect-video w-full max-w-sm"
  );

  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {value ? (
        <div className={frame}>
          <CloudImage
            src={value}
            alt="Uploaded image"
            fill
            sizes={shape === "square" ? "112px" : "384px"}
            className={shape === "square" ? "object-contain p-1" : "object-cover"}
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={disabled || uploading}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file && !disabled) void upload(file);
          }}
          className={cn(
            frame,
            "flex flex-col items-center justify-center gap-1 border-dashed text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
            dragging && "border-primary bg-primary/5"
          )}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5" />
              <span>{shape === "square" ? "Add logo" : "Add photo"}</span>
              {shape === "wide" && <span className="text-[11px]">or drop it here</span>}
            </>
          )}
        </button>
      )}

      {value && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={pick}
            disabled={disabled || uploading}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => replaceValue("")}
            disabled={disabled || uploading}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

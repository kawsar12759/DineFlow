import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertTenantImage,
  cloudinaryPublicId,
  detectImageType,
  isTenantImage,
  signParams,
  tenantFolder,
} from "@/lib/cloudinary";
import { cloudinaryLoader } from "@/components/shared/cloud-image";

const TENANT = "64b7f0c2a1b2c3d4e5f60718";
const url = (path: string) => `https://res.cloudinary.com/demo/image/upload/v1712345678/${path}`;

beforeEach(() => vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo"));
afterEach(() => vi.unstubAllEnvs());

describe("signParams", () => {
  it("matches Cloudinary's documented example", () => {
    expect(
      signParams(
        {
          eager: "w_400,h_300,c_pad|w_260,h_200,c_crop",
          public_id: "sample_image",
          timestamp: 1315060510,
        },
        "abcd"
      )
    ).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });

  it("sorts keys so order does not matter", () => {
    expect(signParams({ b: 2, a: 1 }, "s")).toBe(signParams({ a: 1, b: 2 }, "s"));
  });
});

describe("detectImageType", () => {
  it("recognises JPEG, PNG and WebP from their magic bytes", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(
      detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ).toBe("png");
    expect(detectImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
  });

  it("rejects anything else, whatever it is called", () => {
    expect(detectImageType(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });
});

describe("cloudinaryPublicId", () => {
  it("extracts the public id from a delivery URL", () => {
    expect(cloudinaryPublicId(url(`dineflow/${TENANT}/menu/abc123.jpg`))).toBe(
      `dineflow/${TENANT}/menu/abc123`
    );
    expect(
      cloudinaryPublicId(`https://res.cloudinary.com/demo/image/upload/dineflow/x/logo/a.png`)
    ).toBe("dineflow/x/logo/a");
  });

  it("ignores other clouds, hosts, schemes and path tricks", () => {
    expect(cloudinaryPublicId(url("a/b.jpg").replace("/demo/", "/other/"))).toBeNull();
    expect(cloudinaryPublicId("https://evil.example/demo/image/upload/a/b.jpg")).toBeNull();
    expect(cloudinaryPublicId(url("a/b.jpg").replace("https:", "http:"))).toBeNull();
    expect(cloudinaryPublicId(url(`dineflow/${TENANT}%2F..%2Fother/menu/b.jpg`))).toBeNull();
    expect(cloudinaryPublicId(url("dineflow/x/menu/b.jpg?x=1"))).toBeNull();
    expect(cloudinaryPublicId("not a url")).toBeNull();
  });

  it("returns null when Cloudinary is not configured", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
    expect(cloudinaryPublicId(url("dineflow/x/menu/a.jpg"))).toBeNull();
  });
});

describe("tenant ownership", () => {
  it("only accepts images in the restaurant's own folder", () => {
    expect(tenantFolder(TENANT, "menu")).toBe(`dineflow/${TENANT}/menu`);
    expect(isTenantImage(url(`dineflow/${TENANT}/menu/a.jpg`), TENANT)).toBe(true);
    expect(isTenantImage(url(`dineflow/someone-else/menu/a.jpg`), TENANT)).toBe(false);
    expect(isTenantImage(url(`elsewhere/${TENANT}/menu/a.jpg`), TENANT)).toBe(false);
    // "../" is resolved by the URL parser before the folder check.
    expect(isTenantImage(url(`dineflow/${TENANT}/../other/a.jpg`), TENANT)).toBe(false);
  });

  it("allows empty and unchanged values but rejects foreign URLs", () => {
    expect(() => assertTenantImage(undefined, TENANT)).not.toThrow();
    expect(() => assertTenantImage("", TENANT)).not.toThrow();
    expect(() =>
      assertTenantImage("https://example.com/old.png", TENANT, "https://example.com/old.png")
    ).not.toThrow();
    expect(() => assertTenantImage("https://example.com/new.png", TENANT)).toThrow(
      /upload/i
    );
  });
});

describe("cloudinaryLoader", () => {
  it("asks Cloudinary for a resized, auto-format copy", () => {
    expect(cloudinaryLoader({ src: url("dineflow/x/menu/a.jpg"), width: 640 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/v1712345678/dineflow/x/menu/a.jpg"
    );
  });

  it("leaves other URLs alone", () => {
    expect(cloudinaryLoader({ src: "https://example.com/a.jpg", width: 640 })).toBe(
      "https://example.com/a.jpg"
    );
  });
});

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { Branch, MenuItem, Restaurant, User } from "@/models";
import * as uploadsRoute from "@/app/api/uploads/route";
import * as menuItemsRoute from "@/app/api/menu-items/route";
import * as menuItemRoute from "@/app/api/menu-items/[id]/route";
import * as branchRoute from "@/app/api/branches/[id]/route";
import * as settingsRoute from "@/app/api/settings/route";
import { MAX_IMAGE_BYTES } from "@/lib/cloudinary";
import {
  connectTestDb,
  jsonRequest,
  params,
  resetDb,
  seedTwoTenants,
  signInAs,
} from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

type Seed = Awaited<ReturnType<typeof seedTwoTenants>>;
let seed: Seed;

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);

/** Records what we sent to Cloudinary and answers like it would. */
let uploads: FormData[];
let destroyed: string[];

function mockCloudinary() {
  uploads = [];
  destroyed = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const target = String(input);
    const body = init?.body as FormData;
    if (target === "https://api.cloudinary.com/v1_1/demo/image/upload") {
      uploads.push(body);
      const id = `img${uploads.length}`;
      return Response.json({
        secure_url: `https://res.cloudinary.com/demo/image/upload/v1/${body.get("folder")}/${id}.jpg`,
        width: 800,
        height: 600,
        bytes: 1234,
      });
    }
    if (target === "https://api.cloudinary.com/v1_1/demo/image/destroy") {
      destroyed.push(String(body.get("public_id")));
      return Response.json({ result: "ok" });
    }
    throw new Error(`Unexpected fetch ${target}`);
  });
}

function uploadRequest(
  kind: string,
  bytes: Uint8Array<ArrayBuffer> = JPEG,
  headers: Record<string, string> = {}
) {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", new Blob([bytes]), "photo.jpg");
  return new NextRequest("http://localhost/api/uploads", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": "203.0.113.9", ...headers },
  });
}

async function uploadAs(user: { _id: mongoose.Types.ObjectId }, kind = "menu") {
  signInAs(user);
  const response = await uploadsRoute.POST(uploadRequest(kind));
  expect(response.status).toBe(201);
  return (await response.json()).data.url as string;
}

const imageUrl = (restaurantId: unknown, kind: string, id: string) =>
  `https://res.cloudinary.com/demo/image/upload/v1/dineflow/${restaurantId}/${kind}/${id}.jpg`;

beforeAll(() => connectTestDb("uploads"));
afterAll(() => mongoose.disconnect());
beforeEach(async () => {
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
  vi.stubEnv("CLOUDINARY_API_KEY", "key");
  vi.stubEnv("CLOUDINARY_API_SECRET", "secret");
  mockCloudinary();
  await resetDb();
  seed = await seedTwoTenants();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/uploads", () => {
  it("signs the upload into the restaurant's own folder", async () => {
    const url = await uploadAs(seed.ownerA, "menu");

    expect(url).toBe(imageUrl(seed.restaurantA._id, "menu", "img1"));
    const sent = uploads[0];
    expect(sent.get("folder")).toBe(`dineflow/${seed.restaurantA._id}/menu`);
    expect(sent.get("api_key")).toBe("key");
    expect(sent.get("signature")).toMatch(/^[0-9a-f]{40}$/);
    expect(sent.get("api_secret")).toBeNull();
  });

  it("rejects files that are not JPEG, PNG or WebP", async () => {
    signInAs(seed.ownerA);
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">');
    const response = await uploadsRoute.POST(uploadRequest("menu", svg));
    expect(response.status).toBe(415);
    expect(uploads).toHaveLength(0);
  });

  it("rejects oversized files and unknown kinds", async () => {
    signInAs(seed.ownerA);
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(JPEG);
    expect((await uploadsRoute.POST(uploadRequest("menu", big))).status).toBe(413);
    expect((await uploadsRoute.POST(uploadRequest("avatar"))).status).toBe(400);
    expect(uploads).toHaveLength(0);
  });

  it("checks the role against what the image is for", async () => {
    signInAs(seed.staffA);
    expect((await uploadsRoute.POST(uploadRequest("menu"))).status).toBe(403);

    const manager = await User.create({
      name: "Manager A",
      email: "manager@a.test",
      password: "x",
      role: "manager",
      restaurantId: seed.restaurantA._id,
    });
    signInAs(manager);
    expect((await uploadsRoute.POST(uploadRequest("logo"))).status).toBe(403);
    expect((await uploadsRoute.POST(uploadRequest("branch"))).status).toBe(201);
  });

  it("says so when Cloudinary is not configured", async () => {
    vi.stubEnv("CLOUDINARY_API_SECRET", "");
    signInAs(seed.ownerA);
    expect((await uploadsRoute.POST(uploadRequest("menu"))).status).toBe(503);
  });
});

describe("saving images on records", () => {
  it("only accepts images the restaurant uploaded itself", async () => {
    const urlA = await uploadAs(seed.ownerA);

    signInAs(seed.ownerB);
    for (const image of [urlA, "https://example.com/dish.jpg"]) {
      const response = await menuItemsRoute.POST(
        jsonRequest("/api/menu-items", "POST", {
          name: "Kacchi Biryani",
          price: 450,
          category: "Mains",
          image,
        })
      );
      expect(response.status).toBe(422);
    }
    expect(await MenuItem.countDocuments()).toBe(0);
  });

  it("deletes a menu photo when it is replaced and when the dish is deleted", async () => {
    const first = await uploadAs(seed.ownerA);
    const created = await menuItemsRoute.POST(
      jsonRequest("/api/menu-items", "POST", {
        name: "Kacchi Biryani",
        price: 450,
        category: "Mains",
        image: first,
      })
    );
    const item = (await created.json()).data;
    expect(item.image).toBe(first);

    // Saving other fields with the same image keeps it.
    await menuItemRoute.PATCH(
      jsonRequest(`/api/menu-items/${item._id}`, "PATCH", { price: 480, image: first }),
      params(item._id)
    );
    expect(destroyed).toEqual([]);

    const second = await uploadAs(seed.ownerA);
    const patched = await menuItemRoute.PATCH(
      jsonRequest(`/api/menu-items/${item._id}`, "PATCH", { image: second }),
      params(item._id)
    );
    expect((await patched.json()).data.image).toBe(second);
    expect(destroyed).toEqual([`dineflow/${seed.restaurantA._id}/menu/img1`]);

    await menuItemRoute.DELETE(jsonRequest(`/api/menu-items/${item._id}`, "DELETE"), params(item._id));
    expect(destroyed).toEqual([
      `dineflow/${seed.restaurantA._id}/menu/img1`,
      `dineflow/${seed.restaurantA._id}/menu/img2`,
    ]);
  });

  it("removes a branch cover photo", async () => {
    const cover = imageUrl(seed.restaurantA._id, "branch", "cover");
    await Branch.updateOne({ _id: seed.branchA1._id }, { image: cover });

    signInAs(seed.ownerA);
    const response = await branchRoute.PATCH(
      jsonRequest(`/api/branches/${seed.branchA1._id}`, "PATCH", { image: "" }),
      params(seed.branchA1._id.toString())
    );
    expect(response.status).toBe(200);

    const branch = await Branch.findById(seed.branchA1._id).lean();
    expect(branch?.image).toBeUndefined();
    expect(destroyed).toEqual([`dineflow/${seed.restaurantA._id}/branch/cover`]);
  });

  it("keeps a logo set before uploads existed until it is changed", async () => {
    await Restaurant.updateOne(
      { _id: seed.restaurantA._id },
      { logo: "https://example.com/old-logo.png", cuisine: "Bengali" }
    );
    signInAs(seed.ownerA);

    const unchanged = await settingsRoute.PATCH(
      jsonRequest("/api/settings", "PATCH", {
        profile: { name: "Ember & Oak", logo: "https://example.com/old-logo.png", cuisine: "" },
      })
    );
    expect(unchanged.status).toBe(200);
    const restaurant = await Restaurant.findById(seed.restaurantA._id).lean();
    expect(restaurant?.logo).toBe("https://example.com/old-logo.png");
    // Clearing a field removes it rather than leaving the old value.
    expect(restaurant?.cuisine).toBeUndefined();

    const logo = await uploadAs(seed.ownerA, "logo");
    await settingsRoute.PATCH(jsonRequest("/api/settings", "PATCH", { profile: { name: "Ember & Oak", logo } }));
    // The old logo was not ours, so nothing is deleted from Cloudinary.
    expect(destroyed).toEqual([]);

    await settingsRoute.PATCH(jsonRequest("/api/settings", "PATCH", { profile: { name: "Ember & Oak", logo: "" } }));
    expect((await Restaurant.findById(seed.restaurantA._id).lean())?.logo).toBeUndefined();
    expect(destroyed).toEqual([`dineflow/${seed.restaurantA._id}/logo/img1`]);
  });
});

describe("DELETE /api/uploads", () => {
  it("discards unsaved uploads but keeps images in use", async () => {
    const used = await uploadAs(seed.ownerA);
    const unsaved = await uploadAs(seed.ownerA);
    await MenuItem.create({
      restaurantId: seed.restaurantA._id,
      name: "Fuchka",
      price: 120,
      category: "Starters",
      image: used,
    });

    const keep = await uploadsRoute.DELETE(jsonRequest("/api/uploads", "DELETE", { url: used }));
    expect((await keep.json()).data.deleted).toBe(false);

    const drop = await uploadsRoute.DELETE(jsonRequest("/api/uploads", "DELETE", { url: unsaved }));
    expect((await drop.json()).data.deleted).toBe(true);
    expect(destroyed).toEqual([`dineflow/${seed.restaurantA._id}/menu/img2`]);
  });

  it("will not touch another restaurant's images", async () => {
    const urlA = await uploadAs(seed.ownerA);
    signInAs(seed.ownerB);
    const response = await uploadsRoute.DELETE(jsonRequest("/api/uploads", "DELETE", { url: urlA }));
    expect(response.status).toBe(404);
    expect(destroyed).toEqual([]);
  });
});

import type { TestProject } from "vitest/node";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo: MongoMemoryServer | undefined;

/** Starts one in-memory MongoDB shared by all integration test files. */
export async function setup(project: TestProject) {
  mongo = await MongoMemoryServer.create();
  project.provide("mongoUri", mongo.getUri());
}

export async function teardown() {
  await mongo?.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

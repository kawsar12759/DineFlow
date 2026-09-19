import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/constants";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      restaurantId?: string;
      branchId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role: Role;
    restaurantId?: string;
    branchId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    restaurantId?: string;
    branchId?: string;
  }
}

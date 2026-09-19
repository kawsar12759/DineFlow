import type { NextAuthConfig } from "next-auth";
import { DASHBOARD_ROLES, type Role } from "@/lib/constants";

/**
 * Edge-safe auth config — no database imports.
 * Used by middleware for route protection; the full config in auth.ts
 * adds the Credentials provider (Node-only, needs Mongoose + bcrypt).
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.restaurantId = user.restaurantId;
        token.branchId = user.branchId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.restaurantId = token.restaurantId as string | undefined;
        session.user.branchId = token.branchId as string | undefined;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role as Role | undefined;

      if (pathname.startsWith("/dashboard")) {
        if (!isLoggedIn) return false;
        if (role && !DASHBOARD_ROLES.includes(role)) {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }

      if (
        isLoggedIn &&
        (pathname === "/login" || pathname === "/register")
      ) {
        const target =
          role && DASHBOARD_ROLES.includes(role) ? "/dashboard" : "/";
        return Response.redirect(new URL(target, request.nextUrl));
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

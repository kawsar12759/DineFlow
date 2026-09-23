import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { clientIp, rateLimit } from "@/lib/rate-limit";

class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

const LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60_000;

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Throttle per account and per IP to slow down password guessing.
        const ip = clientIp(request);
        const byAccount = rateLimit(`login:${email.toLowerCase()}`, LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);
        const byIp = ip
          ? rateLimit(`login-ip:${ip}`, LOGIN_ATTEMPTS * 3, LOGIN_WINDOW_MS)
          : { allowed: true };
        if (!byAccount.allowed || !byIp.allowed) throw new RateLimitedSignin();

        await connectDB();
        const user = await User.findOne({ email })
          .select("+password")
          .lean();

        if (!user || !user.isActive) return null;

        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          restaurantId: user.restaurantId?.toString(),
          branchId: user.branchId?.toString(),
        };
      },
    }),
  ],
});

import type { NextAuthConfig } from "next-auth";

export type UserRole = "ADMIN" | "PROJECT_LEAD" | "MEMBER";

declare module "next-auth" {
  interface User {
    role: UserRole;
    username: string;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      role: UserRole;
      username: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    username: string;
  }
}

export const authConfig: NextAuthConfig = {
  providers: [], // providers 在 auth.ts 中配置
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // 临时密码重置接口，靠自身 secret 鉴权
      if (nextUrl.pathname === "/api/admin/reset-passwords") return true;

      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        return false; // 重定向到登录页
      }

      // ADMIN-only 路由保护（其余 /admin/* 子路径放给所有登录用户，由页面 + API 自行判 scope）
      const ADMIN_ONLY_PATHS = ["/admin/users", "/admin/audit-logs"];
      const isAdminOnly = ADMIN_ONLY_PATHS.some((p) =>
        nextUrl.pathname.startsWith(p)
      );
      if (isAdminOnly && auth?.user?.role !== "ADMIN") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.username = token.username;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};

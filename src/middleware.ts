import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware() {
    /* session gate only; staff vs portal handled in layouts */
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token, req }) => {
        const p = req.nextUrl.pathname;
        if (p.startsWith("/api/auth")) return true;
        if (p === "/login") return true;
        return !!token;
      },
    },
  },
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

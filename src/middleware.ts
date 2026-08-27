import { NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/login", "/i/"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/health") ||
    PUBLIC.some((p) => pathname === p || pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }
  const token = req.cookies.get("lihcc_session")?.value;
  if (!token && pathname !== "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

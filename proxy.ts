import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken, likeStrenger } from "@/lib/auth";

const APNE_STIER = ["/logginn", "/api/logginn"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (APNE_STIER.includes(pathname)) return NextResponse.next();

  const passord = process.env.SITE_PASSWORD;
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (passord && cookie && likeStrenger(cookie, await authToken(passord))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return Response.json({ feil: "Ikke innlogget" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/logginn", request.url));
}

export const config = {
  // Alt unntatt Next sine statiske filer.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/proxy", "/_next", "/favicon", "/api/health"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Le JWT est posé par le backend dans un cookie httpOnly nommé
  // "access_token_tenant" (voir geo-backend/src/auth/app-cookie.util.ts —
  // un nom distinct par app évite qu'Admin_tenant et AdminGeoTrust, qui
  // tournent sur le même host "localhost" en dev, ne s'écrasent
  // mutuellement leur session). "access_token" (legacy) reste accepté en
  // repli pour ne pas déconnecter une session posée juste avant ce
  // correctif. httpOnly bloque le JS client, pas la lecture serveur ici. On
  // l'utilise directement comme première barrière de protection ; la
  // validation réelle du token/rôle reste faite par le backend sur chaque
  // endpoint (SidebarLayout appelle /auth/me ensuite).
  const sessionCookie =
    request.cookies.get("access_token_tenant")?.value ??
    request.cookies.get("access_token")?.value;

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirected", "1");
    return NextResponse.redirect(loginUrl);
  }

  // Cookie présent → on laisse passer.
  // SidebarLayout vérifie ensuite le token JWT via /auth/me et valide le rôle admin_tenant.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|proxy|_next/static|_next/image|favicon.ico|api/health).*)"],
};

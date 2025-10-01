import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "./lib/auth/jwtSession";
import { logError, logWarn, logInfo, logDebug } from './services/logger.service';

const PROTECTED_ROUTES = [
  "/driver",
  "/passenger", 
  "/pumpdrive",
  "/patient",
  "/admin",
  "/api/secure-storage",
  "/api/secure",
  "/api/audit",
  "/api/note",
  "/api/priorauth"
];

const PUBLIC_ROUTES = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/auth/check",  // Add check endpoint for debugging
  "/doctor",
  "/api/doctors",
  "/ashna",
  "/simran/pumpllm",  // More specific route first
  "/simran",
  "/api/pump-gpt",
  "/pumpllm",  // Also allow direct access
  "/"
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestHeaders = new Headers(req.headers);
  
  // Skip middleware for static files and API routes we know are public
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/health')) {
    return NextResponse.next();
  }
  
  // Add security headers for all responses
  requestHeaders.set('X-Frame-Options', 'DENY');
  requestHeaders.set('X-Content-Type-Options', 'nosniff');
  requestHeaders.set('X-XSS-Protection', '1; mode=block');
  requestHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  requestHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Check if route is explicitly public
  const isPublic = PUBLIC_ROUTES.some(route => {
    // Check for exact match
    if (pathname === route) return true;
    // Check if pathname starts with route + "/" (for sub-routes)
    if (pathname.startsWith(route + "/")) return true;
    // Check if pathname starts with route + "?" (for query params)
    if (pathname.startsWith(route + "?")) return true;
    // Special case for /simran routes - make all sub-routes public
    if (route === "/simran" && pathname.startsWith("/simran")) return true;
    // Special case for /doctor routes - make all sub-routes public
    if (route === "/doctor" && pathname.startsWith("/doctor")) return true;
    return false;
  });
  
  // If it's a public route, allow access with security headers
  if (isPublic) {
    const response = NextResponse.next({ request: { headers: requestHeaders }});
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return response;
  }
  
  // Check if route needs protection
  const needsAuth = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  // If it doesn't need auth and it's not in public routes, allow access
  if (!needsAuth) {
    const response = NextResponse.next({ request: { headers: requestHeaders }});
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return response;
  }

  // Check for session cookies (JWT first, then legacy session)
  const jwtToken = req.cookies.get("tshla_jwt")?.value;
  const sessionId = req.cookies.get("tshla_session")?.value;
  const cookieHeader = req.headers.get("cookie") || "";
  const host = req.headers.get("host") || "";
  const referer = req.headers.get("referer") || "";
  
  // Enhanced logging for debugging
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});}...)` : 'missing'}`);
  logDebug('App', 'Debug message', {});` : 'missing'}`);
  logDebug('App', 'Debug message', {});.map(c => c.name));
  
  // Validate JWT token if present
  let validSession = false;
  let validationError = null;
  if (jwtToken) {
    try {
      const jwtResult = verifySessionToken(jwtToken);
      if (jwtResult.valid) {
        validSession = true;
        logDebug('App', 'Debug message', {});
      } else {
        logDebug('App', 'Debug message', {});
        validationError = "JWT verification failed";
      }
    } catch (error: any) {
      logDebug('App', 'Debug message', {});
      validationError = error.message;
    }
  }
  
  // If no valid JWT and no session ID, redirect to login
  if (!validSession && !sessionId) {
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    logDebug('App', 'Debug message', {});
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }
  
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});

  // Pass session tokens to API routes via headers
  if (jwtToken) {
    requestHeaders.set("x-jwt-token", jwtToken);
  }
  if (sessionId) {
    requestHeaders.set("x-session-id", sessionId);
  }
  
  // Return with security headers for authenticated routes
  const response = NextResponse.next({ request: { headers: requestHeaders }});
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}

export const config = { 
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ] 
};

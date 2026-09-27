import { NextResponse, type NextRequest } from 'next/server';
import { HOST_REDIRECTS, SITE_HOSTS } from './lib/site';
export function middleware(request: NextRequest) {
  const host = HOST_REDIRECTS[request.nextUrl.hostname];
  if (host) {
    const url = request.nextUrl.clone(); url.hostname = host; url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }
  const response = NextResponse.next();
  if (!SITE_HOSTS.includes(request.nextUrl.hostname)) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|images|fonts|icons).*)'] };

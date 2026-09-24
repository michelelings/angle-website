import { NextResponse, type NextRequest } from 'next/server';
export function middleware(request: NextRequest) {
  if (request.nextUrl.hostname === 'newsangle.co') {
    const url = request.nextUrl.clone(); url.hostname = 'www.newsangle.co'; url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }
  const response = NextResponse.next();
  if (request.nextUrl.hostname !== 'www.newsangle.co') response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|images|fonts|icons).*)'] };

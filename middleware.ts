import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  
  // Only handle non-www hosts for newsangle.co
  // Check if the hostname is newsangle.co (non-www) or any subdomain except www
  const isNonWww = hostname === 'newsangle.co' || 
    (hostname.endsWith('.newsangle.co') && !hostname.startsWith('www.'));
  
  if (isNonWww) {
    const url = request.nextUrl.clone();
    // Build the new hostname (www.newsangle.co)
    url.hostname = 'www.newsangle.co';
    url.protocol = 'https:';
    
    // Return 301 Permanent Redirect
    return NextResponse.redirect(url, 301);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths for non-www hosts
    '/((?!api|icons|images|fonts|.*\\..*).*)',
  ],
};

// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  const isLoginPage = request.nextUrl.pathname === '/login'

  // Redirect authenticated admin away from login
  if (isLoginPage && token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Protect all non-login routes
  if (!isLoginPage && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}
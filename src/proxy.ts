import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isAuthenticated = !!req.auth
  const { pathname } = req.nextUrl

  const publicPaths = ['/login', '/api/auth']
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  if (!isAuthenticated && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

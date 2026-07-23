import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Dev-only CORS: mobile `fetch` ignores CORS, but `expo start --web` makes
// real cross-origin requests from localhost:8081 to this API.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function proxy(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return NextResponse.json({}, { headers: corsHeaders })
  }

  const response = NextResponse.next()
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value)
  }
  return response
}

export const config = {
  matcher: '/api/:path*',
}

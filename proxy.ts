import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Dev-only CORS: mobile `fetch` ignores CORS, but `expo start --web` makes
// real cross-origin requests from localhost:8081 to this API.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const REDACTED_KEYS = new Set(['password', 'token', 'accessToken', 'refreshToken'])

function redact(body: string): string {
  try {
    const parsed = JSON.parse(body)
    for (const key of Object.keys(parsed)) {
      if (REDACTED_KEYS.has(key)) parsed[key] = '***'
    }
    return JSON.stringify(parsed)
  } catch {
    return body
  }
}

export async function proxy(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return NextResponse.json({}, { headers: corsHeaders })
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const body = hasBody ? await request.clone().text().catch(() => '') : ''
  console.log(`--> ${request.method} ${request.nextUrl.pathname}${body ? ' ' + redact(body) : ''}`)

  const response = NextResponse.next()
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value)
  }
  return response
}

export const config = {
  matcher: '/api/:path*',
}

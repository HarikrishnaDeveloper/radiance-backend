import { SignJWT, jwtVerify } from 'jose'

const ACCESS_TOKEN_TTL = '15m'

export interface AuthUserClaims {
  id: string
  username: string | null
  name: string | null
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(user: AuthUserClaims): Promise<string> {
  return new SignJWT({ username: user.username, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getSecretKey())
}

export async function verifyAccessToken(token: string): Promise<AuthUserClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (typeof payload.sub !== 'string') return null
    return {
      id: payload.sub,
      username: typeof payload.username === 'string' ? payload.username : null,
      name: typeof payload.name === 'string' ? payload.name : null,
    }
  } catch {
    return null
  }
}

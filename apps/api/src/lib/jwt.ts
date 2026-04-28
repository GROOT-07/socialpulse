import jwt from 'jsonwebtoken'
import type { JwtPayload, UserRole } from '@socialpulse/shared'

const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL = '30d'
const REMEMBER_REFRESH_TOKEN_TTL = '90d'

interface SignPayload {
  sub: string
  email: string
  role: UserRole
}

export function signAccessToken(payload: SignPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_TTL })
}

export function signRefreshToken(payload: SignPayload, rememberMe = false): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: rememberMe ? REMEMBER_REFRESH_TOKEN_TTL : REFRESH_TOKEN_TTL,
  })
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JwtPayload
}

export function refreshTokenExpiresAt(rememberMe = false): Date {
  const days = rememberMe ? 90 : 30
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

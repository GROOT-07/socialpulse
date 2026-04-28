export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'VIEWER'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
}

export interface JwtPayload {
  sub: string
  email: string
  role: UserRole
  iat: number
  exp: number
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface RegisterBody {
  email: string
  password: string
  orgName: string
  industry: string
}

export interface LoginBody {
  email: string
  password: string
  rememberMe?: boolean
}

export interface AuthResponse {
  user: AuthUser
  tokens: TokenPair
}

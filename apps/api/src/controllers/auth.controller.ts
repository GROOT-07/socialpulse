import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { signAccessToken, signRefreshToken, verifyRefreshToken, refreshTokenExpiresAt } from '../lib/jwt'
import type { AuthRequest } from '../middleware/auth'

// ── Register ──────────────────────────────────────────────────

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, orgName, industry } = req.body as {
    email: string
    password: string
    orgName: string
    industry: string
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Conflict', message: 'An account with this email already exists' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  // Ensure slug is unique
  const slugExists = await prisma.organization.findUnique({ where: { slug } })
  const finalSlug = slugExists ? `${slug}-${Date.now()}` : slug

  const [user, org] = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: { email, passwordHash, role: 'ORG_ADMIN' },
    })

    const newOrg = await tx.organization.create({
      data: {
        name: orgName,
        slug: finalSlug,
        industry,
        ownerId: newUser.id,
        activePlatforms: [],
        members: {
          create: { userId: newUser.id, role: 'ORG_ADMIN', acceptedAt: new Date() },
        },
      },
    })

    await tx.user.update({
      where: { id: newUser.id },
      data: { activeOrgId: newOrg.id },
    })

    return [newUser, newOrg]
  })

  const payload = { sub: user.id, email: user.email, role: user.role }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: refreshTokenExpiresAt(),
    },
  })

  res.status(201).json({
    data: {
      user: { id: user.id, email: user.email, role: user.role },
      org: { id: org.id, name: org.name, slug: org.slug },
      tokens: { accessToken, refreshToken },
    },
  })
}

// ── Login ─────────────────────────────────────────────────────

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, rememberMe = false } = req.body as {
    email: string
    password: string
    rememberMe?: boolean
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' })
    return
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' })
    return
  }

  const payload = { sub: user.id, email: user.email, role: user.role }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload, rememberMe)

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: refreshTokenExpiresAt(rememberMe),
    },
  })

  res.json({
    data: {
      user: { id: user.id, email: user.email, role: user.role, activeOrgId: user.activeOrgId },
      tokens: { accessToken, refreshToken },
    },
  })
}

// ── Logout ────────────────────────────────────────────────────

export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken?: string }

  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
  }

  res.json({ data: { message: 'Logged out successfully' } })
}

// ── Refresh ───────────────────────────────────────────────────

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken: string }

  let payload
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired refresh token' })
    return
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } })
  if (!stored || stored.expiresAt < new Date()) {
    res.status(401).json({ error: 'Unauthorized', message: 'Refresh token revoked or expired' })
    return
  }

  // Rotate: delete old, issue new
  await prisma.refreshToken.delete({ where: { token: refreshToken } })

  const newPayload = { sub: payload.sub, email: payload.email, role: payload.role }
  const accessToken = signAccessToken(newPayload)
  const newRefreshToken = signRefreshToken(newPayload)

  await prisma.refreshToken.create({
    data: {
      token: newRefreshToken,
      userId: payload.sub,
      expiresAt: refreshTokenExpiresAt(),
    },
  })

  res.json({ data: { tokens: { accessToken, refreshToken: newRefreshToken } } })
}

// ── Forgot password ───────────────────────────────────────────

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string }

  // Always respond 200 to prevent email enumeration
  const user = await prisma.user.findUnique({ where: { email } })
  if (user) {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await prisma.passwordResetToken.create({ data: { email, token, expiresAt } })

    // TODO: send email via nodemailer
    // sendPasswordResetEmail(email, token)
    console.info(`[AUTH] Password reset token for ${email}: ${token}`)
  }

  res.json({
    data: { message: "If that email exists, you'll receive a reset link shortly" },
  })
}

// ── Reset password ────────────────────────────────────────────

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as { token: string; password: string }

  const record = await prisma.passwordResetToken.findUnique({ where: { token } })
  if (!record || record.expiresAt < new Date() || record.usedAt) {
    res.status(400).json({ error: 'Bad request', message: 'Reset link is invalid or has expired' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.$transaction([
    prisma.user.update({ where: { email: record.email }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } }),
    // Revoke all refresh tokens on password change
    prisma.refreshToken.deleteMany({
      where: { user: { email: record.email } },
    }),
  ])

  res.json({ data: { message: 'Password reset successfully. Please log in.' } })
}

// ── Me (current user) ─────────────────────────────────────────

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, email: true, role: true, activeOrgId: true, createdAt: true },
  })

  if (!user) {
    res.status(404).json({ error: 'Not found', message: 'User not found' })
    return
  }

  res.json({ data: user })
}

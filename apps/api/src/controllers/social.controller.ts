/**
 * Social OAuth controller
 * Handles connect/callback for Instagram, Facebook, YouTube.
 * Stores encrypted tokens in SocialAccount table.
 * Enqueues an immediate metrics sync after successful connect.
 */

import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { encrypt, decrypt } from '../lib/crypto'
import { metricsQueue } from '../lib/queue'
import { exchangeForLongLivedToken } from '../services/social/metaService'
import { exchangeYouTubeCode } from '../services/social/youtubeService'
import crypto from 'crypto'

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000'
const WEB_BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ── OAuth state helpers ───────────────────────────────────────

function buildOAuthState(orgId: string, userId: string): string {
  return Buffer.from(JSON.stringify({ orgId, userId, nonce: crypto.randomBytes(8).toString('hex') })).toString('base64url')
}

function parseOAuthState(state: string): { orgId: string; userId: string } {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Invalid OAuth state parameter')
  }
}

// ── GET /api/social/accounts ──────────────────────────────────

export async function getConnectedAccounts(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) {
    res.status(400).json({ error: 'Bad Request', message: 'x-org-id header required' })
    return
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { orgId },
    select: {
      id: true,
      platform: true,
      handle: true,
      profileUrl: true,
      tokenExpiresAt: true,
      connectedAt: true,
      // Never send tokens to frontend
    },
    orderBy: { connectedAt: 'asc' },
  })

  res.json({ data: { accounts } })
}

// ── DELETE /api/social/accounts/:id ──────────────────────────

export async function disconnectAccount(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.headers['x-org-id'] as string
  const { id } = req.params

  const account = await prisma.socialAccount.findFirst({
    where: { id, orgId },
  })

  if (!account) {
    res.status(404).json({ error: 'Not Found', message: 'Social account not found' })
    return
  }

  await prisma.socialAccount.delete({ where: { id } })
  res.json({ message: 'Account disconnected successfully' })
}

// ── POST /api/social/accounts/:id/sync ───────────────────────

export async function triggerSync(req: AuthRequest, res: Response): Promise<void> {
  const orgId = req.headers['x-org-id'] as string
  const { id } = req.params

  const account = await prisma.socialAccount.findFirst({
    where: { id, orgId },
  })

  if (!account) {
    res.status(404).json({ error: 'Not Found', message: 'Social account not found' })
    return
  }

  await metricsQueue.add('manual-sync', { orgId }, { priority: 1 })
  res.json({ message: 'Sync queued' })
}

// ── Instagram OAuth ───────────────────────────────────────────
// Flow: connect → Meta dialog → callback → exchange code → long-lived token
// → get IG business account → upsert SocialAccount

export async function instagramConnect(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return }
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id header required' }); return }

  const appId = process.env.META_APP_ID
  if (!appId) { res.status(500).json({ error: 'META_APP_ID not configured' }); return }

  const state = buildOAuthState(orgId, req.user.userId)
  const redirectUri = `${API_BASE}/api/social/auth/instagram/callback`

  const url = new URL('https://www.facebook.com/v22.0/dialog/oauth')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', [
    'instagram_basic',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
    'business_management',
  ].join(','))
  url.searchParams.set('response_type', 'code')

  res.json({ url: url.toString() })
}

export async function instagramCallback(req: AuthRequest, res: Response): Promise<void> {
  const { code, state, error } = req.query as Record<string, string>

  if (error) {
    res.redirect(`${WEB_BASE}/settings/accounts?error=${encodeURIComponent(error)}`)
    return
  }

  if (!code || !state) {
    res.redirect(`${WEB_BASE}/settings/accounts?error=missing_params`)
    return
  }

  try {
    const { orgId } = parseOAuthState(state)
    const redirectUri = `${API_BASE}/api/social/auth/instagram/callback`
    const appId = process.env.META_APP_ID!
    const appSecret = process.env.META_APP_SECRET!

    // Exchange code for short-lived token
    const tokenUrl = new URL('https://graph.facebook.com/v22.0/oauth/access_token')
    tokenUrl.searchParams.set('client_id', appId)
    tokenUrl.searchParams.set('client_secret', appSecret)
    tokenUrl.searchParams.set('redirect_uri', redirectUri)
    tokenUrl.searchParams.set('code', code)

    const tokenRes = await fetch(tokenUrl.toString())
    const tokenJson = await tokenRes.json() as {
      access_token: string
      error?: { message: string }
    }

    if (!tokenRes.ok || tokenJson.error) {
      throw new Error(tokenJson.error?.message ?? 'Token exchange failed')
    }

    // Exchange for long-lived token (60 days)
    const { access_token: longLivedToken, expires_in } = await exchangeForLongLivedToken(tokenJson.access_token)

    // Get user's Facebook pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?access_token=${longLivedToken}`,
    )
    const pagesJson = await pagesRes.json() as {
      data: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }>
    }

    // Find pages with connected Instagram business accounts
    const page = pagesJson.data?.[0]
    if (!page) throw new Error('No Facebook pages found on this account')

    // Get Instagram business account linked to this page
    const igRes = await fetch(
      `https://graph.facebook.com/v22.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`,
    )
    const igJson = await igRes.json() as {
      instagram_business_account?: { id: string }
      error?: { message: string }
    }

    const igBusinessId = igJson.instagram_business_account?.id
    if (!igBusinessId) throw new Error('No Instagram Business Account linked to this Facebook page')

    // Get IG profile info
    const profileRes = await fetch(
      `https://graph.facebook.com/v22.0/${igBusinessId}?fields=username,profile_picture_url,website&access_token=${longLivedToken}`,
    )
    const profileJson = await profileRes.json() as {
      username: string
      profile_picture_url: string
      website: string
      error?: { message: string }
    }

    if (profileJson.error) throw new Error(profileJson.error.message)

    const expiresAt = new Date(Date.now() + expires_in * 1000)

    await prisma.socialAccount.upsert({
      where: { orgId_platform: { orgId, platform: 'INSTAGRAM' } },
      update: {
        handle: igBusinessId, // store IG user ID for API calls
        profileUrl: profileJson.profile_picture_url ?? null,
        accessToken: encrypt(longLivedToken),
        refreshToken: null, // Meta uses long-lived tokens, not refresh tokens
        tokenExpiresAt: expiresAt,
      },
      create: {
        orgId,
        platform: 'INSTAGRAM',
        handle: igBusinessId,
        profileUrl: profileJson.profile_picture_url ?? null,
        accessToken: encrypt(longLivedToken),
        tokenExpiresAt: expiresAt,
      },
    })

    // Trigger an immediate sync
    await metricsQueue.add('post-connect-sync', { orgId, platform: 'INSTAGRAM' }, { priority: 1 })

    res.redirect(`${WEB_BASE}/settings/accounts?connected=instagram`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[instagram-callback]', message)
    res.redirect(`${WEB_BASE}/settings/accounts?error=${encodeURIComponent(message)}`)
  }
}

// ── Facebook OAuth ────────────────────────────────────────────
// Similar to Instagram but connects to the Facebook Page directly

export async function facebookConnect(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return }
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id header required' }); return }

  const appId = process.env.META_APP_ID
  if (!appId) { res.status(500).json({ error: 'META_APP_ID not configured' }); return }

  const state = buildOAuthState(orgId, req.user.userId)
  const redirectUri = `${API_BASE}/api/social/auth/facebook/callback`

  const url = new URL('https://www.facebook.com/v22.0/dialog/oauth')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', [
    'pages_show_list',
    'pages_read_engagement',
    'pages_read_user_content',
    'read_insights',
    'business_management',
  ].join(','))
  url.searchParams.set('response_type', 'code')

  res.json({ url: url.toString() })
}

export async function facebookCallback(req: AuthRequest, res: Response): Promise<void> {
  const { code, state, error } = req.query as Record<string, string>

  if (error) {
    res.redirect(`${WEB_BASE}/settings/accounts?error=${encodeURIComponent(error)}`)
    return
  }

  if (!code || !state) {
    res.redirect(`${WEB_BASE}/settings/accounts?error=missing_params`)
    return
  }

  try {
    const { orgId } = parseOAuthState(state)
    const redirectUri = `${API_BASE}/api/social/auth/facebook/callback`
    const appId = process.env.META_APP_ID!
    const appSecret = process.env.META_APP_SECRET!

    // Exchange code for short-lived token
    const tokenUrl = new URL('https://graph.facebook.com/v22.0/oauth/access_token')
    tokenUrl.searchParams.set('client_id', appId)
    tokenUrl.searchParams.set('client_secret', appSecret)
    tokenUrl.searchParams.set('redirect_uri', redirectUri)
    tokenUrl.searchParams.set('code', code)

    const tokenRes = await fetch(tokenUrl.toString())
    const tokenJson = await tokenRes.json() as {
      access_token: string
      error?: { message: string }
    }

    if (!tokenRes.ok || tokenJson.error) {
      throw new Error(tokenJson.error?.message ?? 'Token exchange failed')
    }

    // Exchange for long-lived token
    const { access_token: longLivedToken, expires_in } = await exchangeForLongLivedToken(tokenJson.access_token)

    // Get the user's pages and use the first one
    const pagesRes = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,picture,fan_count&access_token=${longLivedToken}`,
    )
    const pagesJson = await pagesRes.json() as {
      data: Array<{
        id: string
        name: string
        picture?: { data: { url: string } }
        fan_count?: number
        access_token?: string
      }>
      error?: { message: string }
    }

    if (pagesJson.error) throw new Error(pagesJson.error.message)

    const page = pagesJson.data?.[0]
    if (!page) throw new Error('No Facebook pages found on this account')

    // Prefer page-scoped token if available (has page-level insights access)
    const pageAccessToken = page.access_token ?? longLivedToken
    const pageAccessTokenLongLived = page.access_token
      ? (await exchangeForLongLivedToken(page.access_token)).access_token
      : longLivedToken

    const expiresAt = new Date(Date.now() + expires_in * 1000)

    await prisma.socialAccount.upsert({
      where: { orgId_platform: { orgId, platform: 'FACEBOOK' } },
      update: {
        handle: page.id, // store FB page ID
        profileUrl: page.picture?.data?.url ?? null,
        accessToken: encrypt(pageAccessTokenLongLived),
        tokenExpiresAt: expiresAt,
      },
      create: {
        orgId,
        platform: 'FACEBOOK',
        handle: page.id,
        profileUrl: page.picture?.data?.url ?? null,
        accessToken: encrypt(pageAccessTokenLongLived),
        tokenExpiresAt: expiresAt,
      },
    })

    await metricsQueue.add('post-connect-sync', { orgId, platform: 'FACEBOOK' }, { priority: 1 })

    res.redirect(`${WEB_BASE}/settings/accounts?connected=facebook`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[facebook-callback]', message)
    res.redirect(`${WEB_BASE}/settings/accounts?error=${encodeURIComponent(message)}`)
  }
}

// ── YouTube OAuth ─────────────────────────────────────────────

export async function youtubeConnect(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return }
  const orgId = req.headers['x-org-id'] as string
  if (!orgId) { res.status(400).json({ error: 'x-org-id header required' }); return }

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) { res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured' }); return }

  const state = buildOAuthState(orgId, req.user.userId)
  const redirectUri = `${API_BASE}/api/social/auth/youtube/callback`

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
  ].join(' '))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline') // request refresh token
  url.searchParams.set('prompt', 'consent') // force refresh token on every connect

  res.json({ url: url.toString() })
}

export async function youtubeCallback(req: AuthRequest, res: Response): Promise<void> {
  const { code, state, error } = req.query as Record<string, string>

  if (error) {
    res.redirect(`${WEB_BASE}/settings/accounts?error=${encodeURIComponent(error)}`)
    return
  }

  if (!code || !state) {
    res.redirect(`${WEB_BASE}/settings/accounts?error=missing_params`)
    return
  }

  try {
    const { orgId } = parseOAuthState(state)
    const redirectUri = `${API_BASE}/api/social/auth/youtube/callback`

    const tokens = await exchangeYouTubeCode(code, redirectUri)

    // Get the channel info to store
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true&access_token=${tokens.accessToken}`,
    )
    const channelJson = await channelRes.json() as {
      items?: Array<{
        id: string
        snippet: { title: string; thumbnails: { default: { url: string } } }
      }>
      error?: { message: string }
    }

    if (channelJson.error) throw new Error(channelJson.error.message)

    const channel = channelJson.items?.[0]
    if (!channel) throw new Error('No YouTube channel found for this Google account')

    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000)

    await prisma.socialAccount.upsert({
      where: { orgId_platform: { orgId, platform: 'YOUTUBE' } },
      update: {
        handle: channel.id, // store YT channel ID
        profileUrl: channel.snippet.thumbnails.default.url ?? null,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
        tokenExpiresAt: expiresAt,
      },
      create: {
        orgId,
        platform: 'YOUTUBE',
        handle: channel.id,
        profileUrl: channel.snippet.thumbnails.default.url ?? null,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
        tokenExpiresAt: expiresAt,
      },
    })

    await metricsQueue.add('post-connect-sync', { orgId, platform: 'YOUTUBE' }, { priority: 1 })

    res.redirect(`${WEB_BASE}/settings/accounts?connected=youtube`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[youtube-callback]', message)
    res.redirect(`${WEB_BASE}/settings/accounts?error=${encodeURIComponent(message)}`)
  }
}

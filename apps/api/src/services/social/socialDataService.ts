/**
 * SocialDataService — unified abstraction over Meta + YouTube APIs.
 * Called exclusively from BullMQ workers. Writes snapshots to SocialMetrics table.
 */

import { prisma } from '../../lib/prisma'
import { decrypt } from '../../lib/crypto'
import { Platform, type Prisma } from '@prisma/client'
import {
  getInstagramProfile,
  getInstagramInsights,
  getInstagramMedia,
  getFacebookPageInsights,
  getFacebookPosts,
} from './metaService'
import {
  getYouTubeChannel,
  getYouTubeChannelPublic,
  getYouTubeVideos,
  refreshYouTubeToken,
} from './youtubeService'
import {
  scrapeInstagramProfile,
  scrapeFacebookPage,
} from './apifyService'

// ── Main sync dispatcher ──────────────────────────────────────

export async function syncSocialAccount(socialAccountId: string): Promise<void> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: socialAccountId },
  })

  if (!account) throw new Error(`SocialAccount ${socialAccountId} not found`)
  if (!account.accessToken) throw new Error(`SocialAccount ${socialAccountId} has no access token`)

  const accessToken = decrypt(account.accessToken)

  switch (account.platform) {
    case 'INSTAGRAM':
      await syncInstagram(socialAccountId, accessToken)
      break
    case 'FACEBOOK':
      await syncFacebook(socialAccountId, accessToken)
      break
    case 'YOUTUBE':
      await syncYouTube(account.id, accessToken, account.refreshToken ?? null)
      break
    default:
      throw new Error(`Unsupported platform: ${account.platform}`)
  }
}

// ── Sync all accounts for an org ──────────────────────────────
// Uses OAuth (full insights) when accessToken exists, falls back to
// Apify/YouTube public API when the account was added via URL scan.

export async function syncOrgAccounts(orgId: string): Promise<void> {
  const accounts = await prisma.socialAccount.findMany({ where: { orgId } })

  await Promise.allSettled(
    accounts.map((a) =>
      a.accessToken ? syncSocialAccount(a.id) : syncPublicAccount(a.id),
    ),
  )
}

// ── Sync all accounts across all orgs ────────────────────────

export async function syncAllOrgs(): Promise<void> {
  const accounts = await prisma.socialAccount.findMany({
    select: { id: true, accessToken: true },
  })

  const BATCH = 5
  for (let i = 0; i < accounts.length; i += BATCH) {
    const batch = accounts.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map((a) =>
        a.accessToken ? syncSocialAccount(a.id) : syncPublicAccount(a.id),
      ),
    )
  }
}

// ── Instagram sync ────────────────────────────────────────────

async function syncInstagram(socialAccountId: string, accessToken: string): Promise<void> {
  const account = await prisma.socialAccount.findUnique({ where: { id: socialAccountId } })
  if (!account?.handle) throw new Error('Instagram account has no handle/userId stored')

  const igUserId = account.handle // We store the IG business account user ID as the handle

  const [profile, insights, media] = await Promise.all([
    getInstagramProfile(igUserId, accessToken),
    getInstagramInsights(igUserId, accessToken, 'day').catch(() => []),
    getInstagramMedia(igUserId, accessToken, 30).catch(() => []),
  ])

  // Calculate engagement metrics from recent media
  const recentMedia = media.slice(0, 12) // last 12 posts
  const avgLikes = recentMedia.length > 0
    ? recentMedia.reduce((s, m) => s + m.like_count, 0) / recentMedia.length
    : 0
  const avgComments = recentMedia.length > 0
    ? recentMedia.reduce((s, m) => s + m.comments_count, 0) / recentMedia.length
    : 0

  // Engagement rate = (avg likes + avg comments) / followers * 100
  const engagementRate = profile.followers_count > 0
    ? ((avgLikes + avgComments) / profile.followers_count) * 100
    : 0

  // Get latest daily reach from insights
  const latestInsight = insights.sort((a, b) => b.date.localeCompare(a.date))[0]

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  await prisma.socialMetrics.upsert({
    where: {
      socialAccountId_snapshotDate: {
        socialAccountId,
        snapshotDate: today,
      },
    },
    update: {
      followers: profile.followers_count,
      following: profile.follows_count,
      posts: profile.media_count,
      engagementRate: Math.round(engagementRate * 100) / 100,
      reach: latestInsight?.reach ?? 0,
      impressions: latestInsight?.impressions ?? 0,
      avgLikes: Math.round(avgLikes * 100) / 100,
      avgComments: Math.round(avgComments * 100) / 100,
      rawJson: { profile, latestInsight, topPostsCount: recentMedia.length } as unknown as Prisma.InputJsonValue,
    },
    create: {
      socialAccountId,
      snapshotDate: today,
      followers: profile.followers_count,
      following: profile.follows_count,
      posts: profile.media_count,
      engagementRate: Math.round(engagementRate * 100) / 100,
      reach: latestInsight?.reach ?? 0,
      impressions: latestInsight?.impressions ?? 0,
      avgLikes: Math.round(avgLikes * 100) / 100,
      avgComments: Math.round(avgComments * 100) / 100,
      rawJson: { profile, latestInsight, topPostsCount: recentMedia.length } as unknown as Prisma.InputJsonValue,
    },
  })
}

// ── Facebook sync ─────────────────────────────────────────────

async function syncFacebook(socialAccountId: string, accessToken: string): Promise<void> {
  const account = await prisma.socialAccount.findUnique({ where: { id: socialAccountId } })
  if (!account?.handle) throw new Error('Facebook account has no page ID stored')

  const pageId = account.handle // We store the FB page ID as handle

  const [insights, posts] = await Promise.all([
    getFacebookPageInsights(pageId, accessToken).catch(() => []),
    getFacebookPosts(pageId, accessToken, 20).catch(() => []),
  ])

  // Get the most recent day's insights
  const latestInsight = insights.sort((a, b) => b.date.localeCompare(a.date))[0]

  // Calculate engagement from recent posts
  const recentPosts = posts.slice(0, 12)
  const avgLikes = recentPosts.length > 0
    ? recentPosts.reduce((s, p) => s + (p.likes?.summary?.total_count ?? 0), 0) / recentPosts.length
    : 0
  const avgComments = recentPosts.length > 0
    ? recentPosts.reduce((s, p) => s + (p.comments?.summary?.total_count ?? 0), 0) / recentPosts.length
    : 0

  const fans = latestInsight?.page_fans ?? 0
  const engagementRate = fans > 0 ? ((avgLikes + avgComments) / fans) * 100 : 0

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  await prisma.socialMetrics.upsert({
    where: {
      socialAccountId_snapshotDate: {
        socialAccountId,
        snapshotDate: today,
      },
    },
    update: {
      followers: fans,
      following: 0,
      posts: recentPosts.length,
      engagementRate: Math.round(engagementRate * 100) / 100,
      reach: latestInsight?.page_reach ?? 0,
      impressions: latestInsight?.page_impressions ?? 0,
      avgLikes: Math.round(avgLikes * 100) / 100,
      avgComments: Math.round(avgComments * 100) / 100,
      rawJson: { latestInsight, postCount: recentPosts.length } as unknown as Prisma.InputJsonValue,
    },
    create: {
      socialAccountId,
      snapshotDate: today,
      followers: fans,
      following: 0,
      posts: recentPosts.length,
      engagementRate: Math.round(engagementRate * 100) / 100,
      reach: latestInsight?.page_reach ?? 0,
      impressions: latestInsight?.page_impressions ?? 0,
      avgLikes: Math.round(avgLikes * 100) / 100,
      avgComments: Math.round(avgComments * 100) / 100,
      rawJson: { latestInsight, postCount: recentPosts.length } as unknown as Prisma.InputJsonValue,
    },
  })
}

// ── YouTube sync ──────────────────────────────────────────────

async function syncYouTube(
  socialAccountId: string,
  accessToken: string,
  encryptedRefreshToken: string | null,
): Promise<void> {
  const account = await prisma.socialAccount.findUnique({ where: { id: socialAccountId } })
  if (!account?.handle) throw new Error('YouTube account has no channel ID stored')

  const channelId = account.handle

  // Check if token is expired or about to expire (within 5 min)
  let activeToken = accessToken
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    if (!encryptedRefreshToken) throw new Error('YouTube token expired and no refresh token available')
    const decryptedRefresh = decrypt(encryptedRefreshToken)
    const refreshed = await refreshYouTubeToken(decryptedRefresh)
    activeToken = refreshed.accessToken

    // Persist the new token
    const { encrypt } = await import('../../lib/crypto')
    const newExpiry = new Date(Date.now() + refreshed.expiresIn * 1000)
    await prisma.socialAccount.update({
      where: { id: socialAccountId },
      data: {
        accessToken: encrypt(refreshed.accessToken),
        tokenExpiresAt: newExpiry,
      },
    })
  }

  const [channel, videos] = await Promise.all([
    getYouTubeChannel(activeToken, channelId),
    getYouTubeVideos(activeToken, channelId, 20).catch(() => []),
  ])

  // Calculate engagement from recent videos
  const recentVideos = videos.slice(0, 12)
  const avgLikes = recentVideos.length > 0
    ? recentVideos.reduce((s, v) => s + v.likeCount, 0) / recentVideos.length
    : 0
  const avgComments = recentVideos.length > 0
    ? recentVideos.reduce((s, v) => s + v.commentCount, 0) / recentVideos.length
    : 0

  // YouTube engagement rate = (likes + comments) / views * 100
  const totalViews = recentVideos.reduce((s, v) => s + v.viewCount, 0)
  const totalEngagement = recentVideos.reduce((s, v) => s + v.likeCount + v.commentCount, 0)
  const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  await prisma.socialMetrics.upsert({
    where: {
      socialAccountId_snapshotDate: {
        socialAccountId,
        snapshotDate: today,
      },
    },
    update: {
      followers: channel.subscriberCount,
      following: 0,
      posts: channel.videoCount,
      engagementRate: Math.round(engagementRate * 100) / 100,
      reach: 0, // YouTube doesn't expose reach via Data API v3
      impressions: 0,
      avgLikes: Math.round(avgLikes * 100) / 100,
      avgComments: Math.round(avgComments * 100) / 100,
      rawJson: { channel, recentVideoCount: recentVideos.length } as unknown as Prisma.InputJsonValue,
    },
    create: {
      socialAccountId,
      snapshotDate: today,
      followers: channel.subscriberCount,
      following: 0,
      posts: channel.videoCount,
      engagementRate: Math.round(engagementRate * 100) / 100,
      reach: 0,
      impressions: 0,
      avgLikes: Math.round(avgLikes * 100) / 100,
      avgComments: Math.round(avgComments * 100) / 100,
      rawJson: { channel, recentVideoCount: recentVideos.length } as unknown as Prisma.InputJsonValue,
    },
  })
}

// ── Token refresh check ───────────────────────────────────────

export async function refreshExpiringTokens(socialAccountId?: string): Promise<void> {
  const where = socialAccountId && socialAccountId !== 'ALL'
    ? { id: socialAccountId }
    : {
        platform: Platform.YOUTUBE,
        refreshToken: { not: null },
        tokenExpiresAt: {
          lte: new Date(Date.now() + 24 * 60 * 60 * 1000), // expires within 24h
        },
      }

  const accounts = await prisma.socialAccount.findMany({ where })

  for (const account of accounts) {
    if (account.platform !== 'YOUTUBE' || !account.refreshToken) continue
    try {
      const decryptedRefresh = decrypt(account.refreshToken)
      const refreshed = await refreshYouTubeToken(decryptedRefresh)
      const { encrypt } = await import('../../lib/crypto')
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encrypt(refreshed.accessToken),
          tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
        },
      })
      console.info(`✅ Refreshed token for SocialAccount ${account.id}`)
    } catch (err) {
      console.error(`❌ Failed to refresh token for SocialAccount ${account.id}:`, err)
    }
  }
}

// ── Public sync (no OAuth — uses Apify + YouTube Data API) ────
// Called when a social account was added via profile URL scan (no access token).

export async function syncPublicAccount(socialAccountId: string): Promise<void> {
  const account = await prisma.socialAccount.findUnique({ where: { id: socialAccountId } })
  if (!account) return

  const handle = account.handle ?? extractHandleFromProfileUrl(account.profileUrl ?? '', account.platform)
  if (!handle) {
    console.warn(`[public-sync] No handle for account ${socialAccountId}`)
    return
  }

  try {
    switch (account.platform) {
      case 'INSTAGRAM':
        await syncInstagramPublic(socialAccountId, handle)
        break
      case 'FACEBOOK':
        await syncFacebookPublic(socialAccountId, account.profileUrl ?? handle)
        break
      case 'YOUTUBE':
        await syncYouTubePublic(socialAccountId, handle)
        break
      default:
        // WHATSAPP / GOOGLE — no public scraping available
        break
    }
  } catch (err) {
    console.warn(`[public-sync] Failed for ${account.platform} @${handle}:`, String(err))
  }
}

// ── Instagram public sync via Apify ──────────────────────────

async function syncInstagramPublic(socialAccountId: string, handle: string): Promise<void> {
  const profile = await scrapeInstagramProfile(handle)
  if (!profile) return

  const followers = profile.followersCount
  const engagementRate =
    followers > 0
      ? ((profile.avgLikesPerPost + profile.avgCommentsPerPost) / followers) * 100
      : 0

  // Update the account handle/profileUrl if we got good data
  await prisma.socialAccount.update({
    where: { id: socialAccountId },
    data: {
      handle: profile.username,
      profileUrl: `https://instagram.com/${profile.username}`,
    },
  })

  await upsertDailyMetrics(socialAccountId, {
    followers,
    following: profile.followsCount,
    posts: profile.postsCount,
    engagementRate: Math.round(engagementRate * 100) / 100,
    reach: 0,
    impressions: 0,
    avgLikes: profile.avgLikesPerPost,
    avgComments: profile.avgCommentsPerPost,
    rawJson: profile as unknown as Prisma.InputJsonValue,
  })

  console.info(
    `[public-sync] Instagram @${profile.username} — ${followers.toLocaleString()} followers`,
  )
}

// ── Facebook public sync via Apify ────────────────────────────

async function syncFacebookPublic(socialAccountId: string, pageUrl: string): Promise<void> {
  const page = await scrapeFacebookPage(pageUrl)
  if (!page) return

  const followers = page.followersCount || page.likes

  await upsertDailyMetrics(socialAccountId, {
    followers,
    following: 0,
    posts: 0,
    engagementRate: 0,
    reach: 0,
    impressions: 0,
    avgLikes: 0,
    avgComments: 0,
    rawJson: page as unknown as Prisma.InputJsonValue,
  })

  console.info(
    `[public-sync] Facebook "${page.title}" — ${followers.toLocaleString()} followers`,
  )
}

// ── YouTube public sync via Data API v3 ──────────────────────

async function syncYouTubePublic(socialAccountId: string, handle: string): Promise<void> {
  const channel = await getYouTubeChannelPublic(handle)
  if (!channel) return

  // Update channel ID as handle so future syncs are faster
  await prisma.socialAccount.update({
    where: { id: socialAccountId },
    data: { handle: channel.id },
  })

  await upsertDailyMetrics(socialAccountId, {
    followers: channel.subscriberCount,
    following: 0,
    posts: channel.videoCount,
    engagementRate: 0,
    reach: 0,
    impressions: 0,
    avgLikes: 0,
    avgComments: 0,
    rawJson: channel as unknown as Prisma.InputJsonValue,
  })

  console.info(
    `[public-sync] YouTube "${channel.title}" — ${channel.subscriberCount.toLocaleString()} subscribers`,
  )
}

// ── Shared upsert helper ──────────────────────────────────────

async function upsertDailyMetrics(
  socialAccountId: string,
  data: {
    followers: number
    following: number
    posts: number
    engagementRate: number
    reach: number
    impressions: number
    avgLikes: number
    avgComments: number
    rawJson: Prisma.InputJsonValue
  },
): Promise<void> {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  await prisma.socialMetrics.upsert({
    where: { socialAccountId_snapshotDate: { socialAccountId, snapshotDate: today } },
    create: { socialAccountId, snapshotDate: today, ...data },
    update: data,
  })
}

// ── Handle extraction from profile URL ───────────────────────

function extractHandleFromProfileUrl(url: string, platform: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const parts = u.pathname.split('/').filter(Boolean)
    if (platform === 'YOUTUBE') {
      // Support /@handle, /channel/UCxxx, /c/name, /user/name
      const idx = parts.findIndex((p) => p.startsWith('@') || p === 'channel' || p === 'c' || p === 'user')
      if (idx >= 0) {
        const seg = parts[idx]
        return seg?.startsWith('@') ? seg.slice(1) : (parts[idx + 1] ?? parts[0] ?? null)
      }
    }
    return parts[0] ?? null
  } catch {
    return url.replace('@', '').split('/').pop() ?? null
  }
}
/**
 * Competitor sync service — fetches public profiles via Data365, writes to DB.
 * Called from BullMQ competitor worker only.
 */

import { prisma } from '../../lib/prisma'
import {
  getInstagramCompetitorProfile, getInstagramCompetitorPosts,
  getFacebookCompetitorProfile, getFacebookCompetitorPosts,
  getYouTubeCompetitorProfile, getYouTubeCompetitorPosts,
} from './data365Service'

export async function syncCompetitor(competitorId: string): Promise<void> {
  const competitor = await prisma.competitor.findUnique({ where: { id: competitorId } })
  if (!competitor) throw new Error(`Competitor ${competitorId} not found`)

  const { platform, handle } = competitor
  let followers = 0
  let postsPerWeek = 0
  let avgLikes = 0
  let avgComments = 0
  let engagementRate = 0
  let topPostUrl: string | null = null
  let topPostLikes = 0
  let rawJson: object = {}

  if (platform === 'INSTAGRAM') {
    const [profile, posts] = await Promise.all([
      getInstagramCompetitorProfile(handle),
      getInstagramCompetitorPosts(handle, 20),
    ])
    followers = profile.followers
    const sorted = [...posts].sort((a, b) => b.likesCount - a.likesCount)
    topPostUrl = sorted[0]?.url ?? null
    topPostLikes = sorted[0]?.likesCount ?? 0
    avgLikes = posts.length ? posts.reduce((s, p) => s + p.likesCount, 0) / posts.length : 0
    avgComments = posts.length ? posts.reduce((s, p) => s + p.commentsCount, 0) / posts.length : 0
    engagementRate = followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : 0
    rawJson = { profile, topPost: sorted[0] }

    await prisma.competitor.update({
      where: { id: competitorId },
      data: { profileUrl: profile.profilePicUrl },
    })
  } else if (platform === 'FACEBOOK') {
    const [profile, posts] = await Promise.all([
      getFacebookCompetitorProfile(handle),
      getFacebookCompetitorPosts(handle, 20),
    ])
    followers = profile.followers
    const sorted = [...posts].sort((a, b) => b.likesCount - a.likesCount)
    topPostUrl = sorted[0]?.url ?? null
    topPostLikes = sorted[0]?.likesCount ?? 0
    avgLikes = posts.length ? posts.reduce((s, p) => s + p.likesCount, 0) / posts.length : 0
    avgComments = posts.length ? posts.reduce((s, p) => s + p.commentsCount, 0) / posts.length : 0
    engagementRate = followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : 0
    rawJson = { profile }

    await prisma.competitor.update({
      where: { id: competitorId },
      data: { profileUrl: profile.profilePicUrl },
    })
  } else if (platform === 'YOUTUBE') {
    const [profile, posts] = await Promise.all([
      getYouTubeCompetitorProfile(handle),
      getYouTubeCompetitorPosts(handle, 20),
    ])
    followers = profile.followers
    const sorted = [...posts].sort((a, b) => b.viewsCount - a.viewsCount)
    topPostUrl = sorted[0]?.url ?? null
    topPostLikes = sorted[0]?.likesCount ?? 0
    avgLikes = posts.length ? posts.reduce((s, p) => s + p.likesCount, 0) / posts.length : 0
    avgComments = posts.length ? posts.reduce((s, p) => s + p.commentsCount, 0) / posts.length : 0
    engagementRate = posts.length ? posts.reduce((s, p) => s + p.engagementRate, 0) / posts.length : 0
    rawJson = { profile }

    await prisma.competitor.update({
      where: { id: competitorId },
      data: { profileUrl: profile.profilePicUrl },
    })
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  await prisma.competitorMetrics.upsert({
    where: { competitorId_snapshotDate: { competitorId, snapshotDate: today } },
    update: { followers, engagementRate: Math.round(engagementRate * 100) / 100, avgLikes: Math.round(avgLikes * 100) / 100, avgComments: Math.round(avgComments * 100) / 100, topPostUrl, topPostLikes, rawJson },
    create: { competitorId, snapshotDate: today, followers, engagementRate: Math.round(engagementRate * 100) / 100, avgLikes: Math.round(avgLikes * 100) / 100, avgComments: Math.round(avgComments * 100) / 100, topPostUrl, topPostLikes, rawJson },
  })
}

export async function syncAllCompetitors(): Promise<void> {
  const competitors = await prisma.competitor.findMany({ select: { id: true } })
  const BATCH = 5
  for (let i = 0; i < competitors.length; i += BATCH) {
    await Promise.allSettled(competitors.slice(i, i + BATCH).map((c) => syncCompetitor(c.id)))
  }
}

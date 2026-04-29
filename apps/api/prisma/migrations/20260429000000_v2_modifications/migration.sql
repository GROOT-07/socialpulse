-- SocialPulse V2 Migration
-- Generated for MODIFICATIONS_V2.md
-- Run: prisma migrate dev (from apps/api directory on Windows)

-- ── New Enums ──────────────────────────────────────────────────

CREATE TYPE "KeywordCategory" AS ENUM ('QUICK_WIN', 'MEDIUM', 'LONG_TERM', 'LOCAL');
CREATE TYPE "ContentPieceType" AS ENUM ('POST', 'REEL_SCRIPT', 'BLOG', 'ARTICLE', 'VIDEO_SCRIPT', 'FAQ', 'LANDING_PAGE', 'GOOGLE_POST');
CREATE TYPE "ContentPieceStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "SpecialDayCategory" AS ENUM ('NATIONAL_HOLIDAY', 'RELIGIOUS', 'INDUSTRY', 'INTERNATIONAL', 'AUSPICIOUS');
CREATE TYPE "CompetitorStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');
CREATE TYPE "CompetitorSource" AS ENUM ('GOOGLE_LOCAL', 'GOOGLE_MAPS', 'SOCIAL_DISCOVERY', 'SEO_COMPETITOR', 'MANUAL');

-- ── Update PlaybookSectionType enum ───────────────────────────
ALTER TYPE "PlaybookSectionType" ADD VALUE IF NOT EXISTS 'ORG_SUMMARY';

-- ── Update organizations table ─────────────────────────────────
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "businessType" TEXT,
  ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'English';

-- ── Update competitors table ───────────────────────────────────
ALTER TABLE "competitors"
  ADD COLUMN IF NOT EXISTS "businessName" TEXT,
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "relevanceScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "status" "CompetitorStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "source" "CompetitorSource" NOT NULL DEFAULT 'GOOGLE_LOCAL',
  ADD COLUMN IF NOT EXISTS "discoveryReason" TEXT;

-- ── New table: keyword_opportunities ─────────────────────────
CREATE TABLE IF NOT EXISTS "keyword_opportunities" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "searchVolume" INTEGER NOT NULL DEFAULT 0,
  "difficulty" INTEGER NOT NULL DEFAULT 50,
  "currentRank" INTEGER,
  "competitorDomain" TEXT,
  "competitorRank" INTEGER,
  "targetRank" INTEGER NOT NULL DEFAULT 1,
  "category" "KeywordCategory" NOT NULL DEFAULT 'MEDIUM',
  "contentCreated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "keyword_opportunities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "keyword_opportunities_orgId_keyword_key" UNIQUE ("orgId", "keyword"),
  CONSTRAINT "keyword_opportunities_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── New table: content_pieces ─────────────────────────────────
CREATE TABLE IF NOT EXISTS "content_pieces" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "type" "ContentPieceType" NOT NULL,
  "platform" "Platform",
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "hashtags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "seoScore" INTEGER NOT NULL DEFAULT 0,
  "keywordTargeted" TEXT,
  "status" "ContentPieceStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "externalUrl" TEXT,
  "generatedByAI" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_pieces_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "content_pieces_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── New table: org_intelligence ───────────────────────────────
CREATE TABLE IF NOT EXISTS "org_intelligence" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "googleKgData" JSONB,
  "googlePlacesData" JSONB,
  "websiteMetaData" JSONB,
  "detectedKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "presenceScore" INTEGER NOT NULL DEFAULT 0,
  "presenceScoreBreakdown" JSONB,
  "strengths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "urgentIssues" JSONB,
  "quickWins" JSONB,
  "aiDiagnosis" JSONB,
  "lastScannedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "org_intelligence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "org_intelligence_orgId_key" UNIQUE ("orgId"),
  CONSTRAINT "org_intelligence_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── New table: special_days ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "special_days" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "category" "SpecialDayCategory" NOT NULL,
  "countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "industries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "draftPostTemplate" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "special_days_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "special_days_name_date_key" UNIQUE ("name", "date")
);

-- ── New table: trending_topics ────────────────────────────────
CREATE TABLE IF NOT EXISTS "trending_topics" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "searchVolume" INTEGER NOT NULL DEFAULT 0,
  "trendDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "competitorsCovering" INTEGER NOT NULL DEFAULT 0,
  "suggestedPostDraft" TEXT,
  "platform" "Platform",
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trending_topics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trending_topics_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── New table: competitor_posts ───────────────────────────────
CREATE TABLE IF NOT EXISTS "competitor_posts" (
  "id" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "postUrl" TEXT,
  "caption" TEXT,
  "likesCount" INTEGER NOT NULL DEFAULT 0,
  "commentsCount" INTEGER NOT NULL DEFAULT 0,
  "sharesCount" INTEGER NOT NULL DEFAULT 0,
  "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "postedAt" TIMESTAMP(3),
  "contentType" TEXT,
  "hashtags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "competitor_posts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competitor_posts_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── Indexes for performance ───────────────────────────────────
CREATE INDEX IF NOT EXISTS "keyword_opportunities_orgId_category_idx" ON "keyword_opportunities"("orgId", "category");
CREATE INDEX IF NOT EXISTS "content_pieces_orgId_type_idx" ON "content_pieces"("orgId", "type");
CREATE INDEX IF NOT EXISTS "content_pieces_orgId_status_idx" ON "content_pieces"("orgId", "status");
CREATE INDEX IF NOT EXISTS "trending_topics_orgId_fetchedAt_idx" ON "trending_topics"("orgId", "fetchedAt");
CREATE INDEX IF NOT EXISTS "competitor_posts_competitorId_postedAt_idx" ON "competitor_posts"("competitorId", "postedAt");
CREATE INDEX IF NOT EXISTS "special_days_date_idx" ON "special_days"("date");

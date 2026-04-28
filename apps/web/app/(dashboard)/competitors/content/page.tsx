'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Heart, MessageCircle, Play, Image, FileText, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { competitorApi, type CompetitorPost, type Competitor } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatNumber } from '@/lib/utils'

const MEDIA_ICONS: Record<string, React.ElementType> = {
  VIDEO: Play,
  IMAGE: Image,
  CAROUSEL: Image,
}

function PostCard({ post }: { post: CompetitorPost }) {
  const Icon = MEDIA_ICONS[post.mediaType ?? ''] ?? FileText
  return (
    <Card className="overflow-hidden">
      {post.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumbnailUrl} alt="thumbnail" className="h-40 w-full object-cover" />
      ) : (
        <div className="h-40 w-full flex items-center justify-center bg-surface-2">
          <Icon className="h-8 w-8 text-[var(--color-text-4)]" />
        </div>
      )}
      <CardContent className="p-3">
        {post.caption && (
          <p className="mb-2 text-xs text-[var(--color-text-2)] line-clamp-3">{post.caption}</p>
        )}
        <div className="flex items-center justify-between text-xs text-[var(--color-text-4)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {post.likes != null ? formatNumber(post.likes) : '—'}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {post.comments != null ? formatNumber(post.comments) : '—'}
            </span>
            {post.views != null && (
              <span className="flex items-center gap-1">
                <Play className="h-3 w-3" />
                {formatNumber(post.views)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {post.mediaType && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">{post.mediaType}</Badge>
            )}
            {post.engagementRate != null && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 bg-accent-light text-accent border-accent/20">
                {post.engagementRate.toFixed(1)}%
              </Badge>
            )}
          </div>
        </div>
        {post.postedAt && (
          <p className="mt-1.5 text-[10px] text-[var(--color-text-4)]">
            {new Date(post.postedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function ContentSpyInner() {
  const params = useSearchParams()
  const [selectedId, setSelectedId] = React.useState<string>(params.get('id') ?? '')

  const { data: competitorList } = useQuery({
    queryKey: ['competitors'],
    queryFn: () => competitorApi.list(),
  })

  const competitors = competitorList?.competitors ?? []

  const { data: postsData, isLoading } = useQuery({
    queryKey: ['competitor-posts', selectedId],
    queryFn: () => competitorApi.posts(selectedId, 30),
    enabled: !!selectedId,
  })

  const posts = postsData?.posts ?? []
  const selectedCompetitor = competitors.find(c => c.id === selectedId)

  return (
    <>
      <PageHeader
        title="Content Spy"
        description="Browse competitor posts and spot what's driving their engagement."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/competitors"><button className="flex items-center gap-1 text-sm text-[var(--color-text-3)] hover:text-[var(--color-text)]"><ArrowLeft className="h-3.5 w-3.5" />Back</button></Link>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-48 h-8 text-xs">
                <SelectValue placeholder="Select competitor" />
              </SelectTrigger>
              <SelectContent>
                {competitors.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} (@{c.handle})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {!selectedId ? (
        <Card><CardContent className="p-0">
          <EmptyState
            icon={<ExternalLink className="h-12 w-12" />}
            heading="Select a competitor"
            description="Choose a tracked competitor from the dropdown to view their recent posts."
          />
        </CardContent></Card>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-0">
              <div className="skeleton h-40 w-full" />
              <div className="p-3 space-y-2">
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-2/3 rounded" />
              </div>
            </CardContent></Card>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <Card><CardContent className="p-0">
          <EmptyState
            icon={<FileText className="h-12 w-12" />}
            heading="No posts found"
            description={`Sync ${selectedCompetitor?.name ?? 'this competitor'} to fetch their recent content.`}
          />
        </CardContent></Card>
      ) : (
        <>
          <p className="mb-4 text-xs text-[var(--color-text-4)]">
            Showing {posts.length} recent posts from <strong>{selectedCompetitor?.name}</strong>
            {' · '}sorted by engagement
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {posts
              .slice()
              .sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))
              .map(p => <PostCard key={p.id} post={p} />)
            }
          </div>
        </>
      )}
    </>
  )
}

export default function ContentSpyPage() {
  return (
    <Suspense>
      <ContentSpyInner />
    </Suspense>
  )
}

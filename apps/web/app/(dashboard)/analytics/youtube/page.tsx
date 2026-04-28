import type { Metadata } from 'next'
import { PlatformAnalyticsPage } from '@/components/analytics/PlatformAnalyticsPage'

export const metadata: Metadata = { title: 'YouTube Analytics' }

export default function YouTubeAnalyticsPage() {
  return <PlatformAnalyticsPage platform="youtube" />
}

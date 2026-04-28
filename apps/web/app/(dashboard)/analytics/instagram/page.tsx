import type { Metadata } from 'next'
import { PlatformAnalyticsPage } from '@/components/analytics/PlatformAnalyticsPage'

export const metadata: Metadata = { title: 'Instagram Analytics' }

export default function InstagramAnalyticsPage() {
  return <PlatformAnalyticsPage platform="instagram" />
}

import type { Metadata } from 'next'
import { PlatformAnalyticsPage } from '@/components/analytics/PlatformAnalyticsPage'

export const metadata: Metadata = { title: 'Facebook Analytics' }

export default function FacebookAnalyticsPage() {
  return <PlatformAnalyticsPage platform="facebook" />
}

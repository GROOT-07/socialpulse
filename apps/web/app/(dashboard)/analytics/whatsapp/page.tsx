import type { Metadata } from 'next'
import { WhatsAppAnalyticsPage } from '@/components/analytics/WhatsAppAnalyticsPage'

export const metadata: Metadata = { title: 'WhatsApp Analytics' }

export default function WhatsAppAnalyticsRoute() {
  return <WhatsAppAnalyticsPage />
}

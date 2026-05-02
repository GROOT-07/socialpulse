import type { Metadata } from 'next'
import { MeetingIntelligencePage } from '@/components/team/MeetingIntelligencePage'

export const metadata: Metadata = { title: 'Meeting Intelligence — Team Hub' }

export default function MeetingIntelligenceRoute() {
  return <MeetingIntelligencePage />
}

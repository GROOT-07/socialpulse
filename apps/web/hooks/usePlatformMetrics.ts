'use client'

import { useQuery } from '@tanstack/react-query'
import { metricsApi } from '@/lib/api'
import type { PlatformMetricsResponse } from '@/lib/api'

export function usePlatformMetrics(
  platform: 'instagram' | 'facebook' | 'youtube',
  days: number,
) {
  return useQuery<PlatformMetricsResponse>({
    queryKey: ['metrics', platform, days],
    queryFn: () => metricsApi.platform(platform, days) as Promise<PlatformMetricsResponse>,
    retry: 1,
  })
}

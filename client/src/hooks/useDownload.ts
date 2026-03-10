import { useState, useCallback, useRef } from 'react'
import { startDownload, getJobStatus } from '@/api'
import type { DownloadJob } from '@/types'

interface ActiveJob {
  id: number
  url: string
  job: DownloadJob
}

export function useDownload(onComplete?: () => void) {
  const [jobs, setJobs] = useState<ActiveJob[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const intervalsRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map())

  const pollJob = useCallback((jobId: number, url: string) => {
    const interval = setInterval(async () => {
      try {
        const job = await getJobStatus(jobId)
        setJobs(prev =>
          prev.map(j => j.id === jobId ? { ...j, job } : j)
        )
        if (job.status === 'done' || job.status === 'error') {
          clearInterval(interval)
          intervalsRef.current.delete(jobId)
          if (job.status === 'done') {
            onComplete?.()
            setTimeout(() => {
              setJobs(prev => prev.filter(j => j.id !== jobId))
            }, 3000)
          }
        }
      } catch {
        clearInterval(interval)
        intervalsRef.current.delete(jobId)
      }
    }, 1000)
    intervalsRef.current.set(jobId, interval)
  }, [onComplete])

  const download = useCallback(async (url: string, playlistId?: number) => {
    setIsSubmitting(true)
    try {
      const job = await startDownload(url, playlistId)
      const activeJob: ActiveJob = { id: job.id, url, job }
      setJobs(prev => [activeJob, ...prev])
      pollJob(job.id, url)
    } finally {
      setIsSubmitting(false)
    }
  }, [pollJob])

  const removeJob = useCallback((id: number) => {
    const interval = intervalsRef.current.get(id)
    if (interval) {
      clearInterval(interval)
      intervalsRef.current.delete(id)
    }
    setJobs(prev => prev.filter(j => j.id !== id))
  }, [])

  return { jobs, download, isSubmitting, removeJob }
}
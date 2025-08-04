"use client"

import React from 'react'
import { SessionCacheManager, SessionCacheConfig, useSessionCacheManager } from '@/lib/session-cache'

// React context for session cache (if needed for dependency injection)
const SessionCacheContext = React.createContext<SessionCacheManager | null>(null)

export function SessionCacheProvider({ 
  children, 
  config 
}: { 
  children: React.ReactNode
  config?: Partial<SessionCacheConfig> 
}) {
  const cacheManager = useSessionCacheManager(config)

  return (
    <SessionCacheContext.Provider value={cacheManager}>
      {children}
    </SessionCacheContext.Provider>
  )
}

export function useSessionCacheContext(): SessionCacheManager {
  const context = React.useContext(SessionCacheContext)
  if (!context) {
    throw new Error('useSessionCacheContext must be used within a SessionCacheProvider')
  }
  return context
}
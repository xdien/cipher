"use client"

import React from 'react'
import { Session } from '@/types/server-registry'
import { ChatMessage } from '@/types/chat'

// Session metadata for localStorage persistence
export interface SessionMetadata {
  id: string
  createdAt: string | null
  lastActivity: string | null
  messageCount: number
  lastAccessed: number
  isStarred?: boolean
  tags?: string[]
}

// Cache configuration
export interface SessionCacheConfig {
  maxEntries: number
  maxAge: number // milliseconds
  persistMetadata: boolean
  enableCompression: boolean
}

// Default configuration
export const DEFAULT_CACHE_CONFIG: SessionCacheConfig = {
  maxEntries: 20,
  maxAge: 10 * 60 * 1000, // 10 minutes
  persistMetadata: true,
  enableCompression: false, // Disable for now as it adds complexity
}

// Session cache storage keys
export const CACHE_KEYS = {
  METADATA: 'cipher-session-metadata',
  MESSAGES: 'cipher-session-messages',
  CONFIG: 'cipher-session-config',
  STATS: 'cipher-session-stats',
} as const

// Cache statistics
export interface CacheStats {
  totalSessions: number
  cacheHits: number
  cacheMisses: number
  lastCleanup: number
  memoryUsage: number // rough estimate in bytes
}

// Session cache utility class
export class SessionCacheManager {
  private config: SessionCacheConfig
  private stats: CacheStats
  private memoryCache: Map<string, { messages: ChatMessage[]; timestamp: number }>

  constructor(config: Partial<SessionCacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config }
    this.memoryCache = new Map()
    this.stats = this.loadStats()
    
    // Cleanup expired entries on initialization
    this.cleanup()
    
    // Set up periodic cleanup
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), 5 * 60 * 1000) // Every 5 minutes
    }
  }

  // Load statistics from localStorage
  private loadStats(): CacheStats {
    if (typeof window === 'undefined') {
      return this.getDefaultStats()
    }

    try {
      const stored = localStorage.getItem(CACHE_KEYS.STATS)
      if (stored) {
        return { ...this.getDefaultStats(), ...JSON.parse(stored) }
      }
    } catch (error) {
      console.warn('Failed to load cache stats:', error)
    }

    return this.getDefaultStats()
  }

  private getDefaultStats(): CacheStats {
    return {
      totalSessions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastCleanup: Date.now(),
      memoryUsage: 0,
    }
  }

  // Save statistics to localStorage
  private saveStats(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(CACHE_KEYS.STATS, JSON.stringify(this.stats))
    } catch (error) {
      console.warn('Failed to save cache stats:', error)
    }
  }

  // Get session metadata from localStorage
  getSessionMetadata(sessionId: string): SessionMetadata | null {
    if (!this.config.persistMetadata || typeof window === 'undefined') {
      return null
    }

    try {
      const key = `${CACHE_KEYS.METADATA}-${sessionId}`
      const stored = localStorage.getItem(key)
      if (stored) {
        const metadata: SessionMetadata = JSON.parse(stored)
        
        // Check if expired
        if (Date.now() - metadata.lastAccessed > this.config.maxAge) {
          localStorage.removeItem(key)
          return null
        }
        
        return metadata
      }
    } catch (error) {
      console.warn('Failed to get session metadata:', error)
    }

    return null
  }

  // Save session metadata to localStorage
  setSessionMetadata(sessionId: string, session: Session): void {
    if (!this.config.persistMetadata || typeof window === 'undefined') {
      return
    }

    try {
      const metadata: SessionMetadata = {
        id: session.id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        messageCount: session.messageCount,
        lastAccessed: Date.now(),
      }

      const key = `${CACHE_KEYS.METADATA}-${sessionId}`
      localStorage.setItem(key, JSON.stringify(metadata))
    } catch (error) {
      console.warn('Failed to save session metadata:', error)
      
      // If storage is full, try to clean up and retry
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.cleanup()
        try {
          const key = `${CACHE_KEYS.METADATA}-${sessionId}`
          localStorage.setItem(key, JSON.stringify({
            id: session.id,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            messageCount: session.messageCount,
            lastAccessed: Date.now(),
          }))
        } catch (retryError) {
          console.error('Failed to save session metadata after cleanup:', retryError)
        }
      }
    }
  }

  // Get session messages from memory cache
  getSessionMessages(sessionId: string): ChatMessage[] | null {
    const cached = this.memoryCache.get(sessionId)
    
    if (cached) {
      // Check if expired
      if (Date.now() - cached.timestamp > this.config.maxAge) {
        this.memoryCache.delete(sessionId)
        this.stats.cacheMisses++
        return null
      }
      
      // Update access time in metadata
      const metadata = this.getSessionMetadata(sessionId)
      if (metadata) {
        metadata.lastAccessed = Date.now()
        this.setSessionMetadata(sessionId, {
          id: metadata.id,
          createdAt: metadata.createdAt,
          lastActivity: metadata.lastActivity,
          messageCount: metadata.messageCount,
        })
      }
      
      this.stats.cacheHits++
      this.saveStats()
      return cached.messages
    }

    this.stats.cacheMisses++
    this.saveStats()
    return null
  }

  // Save session messages to memory cache
  setSessionMessages(sessionId: string, messages: ChatMessage[]): void {
    // Check if we need to evict entries
    if (this.memoryCache.size >= this.config.maxEntries) {
      this.evictLeastRecentlyUsed()
    }

    this.memoryCache.set(sessionId, {
      messages: messages.slice(), // Clone array to prevent mutations
      timestamp: Date.now(),
    })

    // Update memory usage estimate
    this.updateMemoryUsage()
    this.saveStats()
  }

  // Remove session from cache
  removeSession(sessionId: string): void {
    // Remove from memory cache
    this.memoryCache.delete(sessionId)

    // Remove metadata from localStorage
    if (this.config.persistMetadata && typeof window !== 'undefined') {
      try {
        const key = `${CACHE_KEYS.METADATA}-${sessionId}`
        localStorage.removeItem(key)
      } catch (error) {
        console.warn('Failed to remove session metadata:', error)
      }
    }

    this.updateMemoryUsage()
    this.saveStats()
  }

  // Clear all cached data
  clearAll(): void {
    this.memoryCache.clear()

    if (typeof window !== 'undefined') {
      try {
        // Remove all session metadata
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
          if (key.startsWith(CACHE_KEYS.METADATA)) {
            localStorage.removeItem(key)
          }
        })
      } catch (error) {
        console.warn('Failed to clear localStorage cache:', error)
      }
    }

    this.stats = this.getDefaultStats()
    this.saveStats()
  }

  // Get cache statistics
  getStats(): CacheStats {
    this.updateMemoryUsage()
    return { ...this.stats }
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now()
    
    // Clean memory cache
    for (const [sessionId, cached] of this.memoryCache.entries()) {
      if (now - cached.timestamp > this.config.maxAge) {
        this.memoryCache.delete(sessionId)
      }
    }

    // Clean localStorage metadata
    if (this.config.persistMetadata && typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
          if (key.startsWith(CACHE_KEYS.METADATA)) {
            try {
              const stored = localStorage.getItem(key)
              if (stored) {
                const metadata: SessionMetadata = JSON.parse(stored)
                if (now - metadata.lastAccessed > this.config.maxAge) {
                  localStorage.removeItem(key)
                }
              }
            } catch (error) {
              // Remove invalid entries
              localStorage.removeItem(key)
            }
          }
        })
      } catch (error) {
        console.warn('Failed to cleanup localStorage cache:', error)
      }
    }

    this.stats.lastCleanup = now
    this.updateMemoryUsage()
    this.saveStats()
  }

  // Evict least recently used entries
  private evictLeastRecentlyUsed(): void {
    if (this.memoryCache.size === 0) return

    let oldestKey: string | null = null
    let oldestTime = Date.now()

    // Find the oldest entry in memory cache
    for (const [sessionId, cached] of this.memoryCache.entries()) {
      if (cached.timestamp < oldestTime) {
        oldestTime = cached.timestamp
        oldestKey = sessionId
      }
    }

    // Also check metadata timestamps
    if (this.config.persistMetadata && typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
          if (key.startsWith(CACHE_KEYS.METADATA)) {
            try {
              const stored = localStorage.getItem(key)
              if (stored) {
                const metadata: SessionMetadata = JSON.parse(stored)
                if (metadata.lastAccessed < oldestTime) {
                  oldestTime = metadata.lastAccessed
                  oldestKey = metadata.id
                }
              }
            } catch (error) {
              // Ignore parsing errors
            }
          }
        })
      } catch (error) {
        console.warn('Failed to check metadata for LRU eviction:', error)
      }
    }

    if (oldestKey) {
      this.removeSession(oldestKey)
    }
  }

  // Update memory usage estimate
  private updateMemoryUsage(): void {
    let usage = 0
    
    for (const [sessionId, cached] of this.memoryCache.entries()) {
      // Rough estimate: session ID + message data
      usage += sessionId.length * 2 // UTF-16 encoding
      usage += JSON.stringify(cached.messages).length * 2
    }

    this.stats.totalSessions = this.memoryCache.size
    this.stats.memoryUsage = usage
  }

  // Update configuration
  updateConfig(newConfig: Partial<SessionCacheConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // If max entries reduced, evict excess entries
    while (this.memoryCache.size > this.config.maxEntries) {
      this.evictLeastRecentlyUsed()
    }
  }

  // Check if session is cached
  hasSession(sessionId: string): boolean {
    return this.memoryCache.has(sessionId) || this.getSessionMetadata(sessionId) !== null
  }

  // Get all cached session IDs
  getCachedSessionIds(): string[] {
    const memoryIds = Array.from(this.memoryCache.keys())
    const metadataIds: string[] = []

    if (this.config.persistMetadata && typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
          if (key.startsWith(CACHE_KEYS.METADATA)) {
            const sessionId = key.replace(`${CACHE_KEYS.METADATA}-`, '')
            if (!memoryIds.includes(sessionId)) {
              metadataIds.push(sessionId)
            }
          }
        })
      } catch (error) {
        console.warn('Failed to get metadata session IDs:', error)
      }
    }

    return [...memoryIds, ...metadataIds]
  }
}

// Create a default instance
export const sessionCache = new SessionCacheManager()

// React hook for using session cache
export function useSessionCacheManager(config?: Partial<SessionCacheConfig>) {
  const [cacheManager] = React.useState(() => new SessionCacheManager(config))
  
  React.useEffect(() => {
    return () => {
      // Cleanup on unmount
      cacheManager.cleanup()
    }
  }, [cacheManager])

  return cacheManager
}
/**
 * Transport interfaces for event delivery
 */

import { Event, EventFilter } from './events.js';

export interface EventTransport {
  sendEvent(event: Event): Promise<void>;
}

export interface FilteredEventTransport extends EventTransport {
  filter?: EventFilter;
  sendMatchedEvent(event: Event): Promise<void>;
}

/**
 * Configuration for HTTP transport
 */
export interface HttpTransportConfig {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Configuration for file transport
 */
export interface FileTransportConfig {
  filePath: string;
  maxFileSize?: number;
  maxFiles?: number;
  format?: 'json' | 'jsonl' | 'text';
}

/**
 * Configuration for console transport
 */
export interface ConsoleTransportConfig {
  colorize?: boolean;
  format?: 'json' | 'text' | 'pretty';
  includeTimestamp?: boolean;
}

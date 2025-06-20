/**
 * Console listener for outputting events to the console
 */

import { Event, EventFilter, ConsoleTransportConfig } from '../types/index.js';
import { BaseFilteredListener } from './base.js';

/**
 * ANSI color codes for console output
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
} as const;

/**
 * Color mapping for different event types
 */
const TYPE_COLORS = {
  debug: COLORS.gray,
  info: COLORS.blue,
  warning: COLORS.yellow,
  error: COLORS.red,
  progress: COLORS.green,
} as const;

export class ConsoleListener extends BaseFilteredListener {
  private config: Required<ConsoleTransportConfig>;

  constructor(config: ConsoleTransportConfig = {}, filter?: EventFilter) {
    super(filter);
    
    this.config = {
      colorize: config.colorize ?? true,
      format: config.format ?? 'pretty',
      includeTimestamp: config.includeTimestamp ?? true,
    };
  }

  async handleMatchedEvent(event: Event): Promise<void> {
    const formatted = this.formatEvent(event);
    
    // Use appropriate console method based on event type
    switch (event.type) {
      case 'error':
        console.error(formatted);
        break;
      case 'warning':
        console.warn(formatted);
        break;
      case 'debug':
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  /**
   * Format an event for console output
   */
  private formatEvent(event: Event): string {
    switch (this.config.format) {
      case 'json':
        return JSON.stringify(event, null, 2);
      case 'text':
        return this.formatAsText(event);
      case 'pretty':
      default:
        return this.formatAsPretty(event);
    }
  }

  /**
   * Format event as simple text
   */
  private formatAsText(event: Event): string {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      parts.push(event.timestamp.toISOString());
    }

    parts.push(`[${event.type.toUpperCase()}]`);
    parts.push(`[${event.namespace}]`);

    if (event.name) {
      parts.push(`[${event.name}]`);
    }

    parts.push(event.message);

    return parts.join(' ');
  }

  /**
   * Format event with colors and enhanced formatting
   */
  private formatAsPretty(event: Event): string {
    const parts: string[] = [];
    const typeColor = TYPE_COLORS[event.type] || COLORS.white;

    // Timestamp
    if (this.config.includeTimestamp) {
      const timestamp = this.config.colorize 
        ? `${COLORS.gray}${event.timestamp.toISOString()}${COLORS.reset}`
        : event.timestamp.toISOString();
      parts.push(timestamp);
    }

    // Event type
    const typeLabel = this.config.colorize
      ? `${typeColor}[${event.type.toUpperCase()}]${COLORS.reset}`
      : `[${event.type.toUpperCase()}]`;
    parts.push(typeLabel);

    // Namespace
    const namespace = this.config.colorize
      ? `${COLORS.cyan}[${event.namespace}]${COLORS.reset}`
      : `[${event.namespace}]`;
    parts.push(namespace);

    // Event name
    if (event.name) {
      const name = this.config.colorize
        ? `${COLORS.magenta}[${event.name}]${COLORS.reset}`
        : `[${event.name}]`;
      parts.push(name);
    }

    // Message
    const message = this.config.colorize && event.type === 'error'
      ? `${COLORS.red}${event.message}${COLORS.reset}`
      : event.message;
    parts.push(message);

    // Additional data (if present and not empty)
    if (event.data && Object.keys(event.data).length > 0) {
      const dataStr = this.formatData(event.data);
      if (dataStr) {
        parts.push(dataStr);
      }
    }

    // Context (if present)
    if (event.context && Object.keys(event.context).length > 0) {
      const contextStr = this.formatContext(event.context);
      if (contextStr) {
        parts.push(contextStr);
      }
    }

    return parts.join(' ');
  }

  /**
   * Format event data for display
   */
  private formatData(data: Record<string, any>): string {
    try {
      // Handle special cases
      if (data.percentage !== undefined) {
        return this.config.colorize
          ? `${COLORS.green}(${data.percentage}%)${COLORS.reset}`
          : `(${data.percentage}%)`;
      }

      if (data.duration_ms !== undefined) {
        return this.config.colorize
          ? `${COLORS.yellow}(${data.duration_ms}ms)${COLORS.reset}`
          : `(${data.duration_ms}ms)`;
      }

      if (data.error) {
        const errorInfo = typeof data.error === 'object' 
          ? `${data.error.name}: ${data.error.message}`
          : String(data.error);
        return this.config.colorize
          ? `${COLORS.red}${errorInfo}${COLORS.reset}`
          : errorInfo;
      }

      // For other data, show as compact JSON
      const filtered = Object.fromEntries(
        Object.entries(data).filter(([key]) => 
          !['percentage', 'duration_ms', 'error', 'operation'].includes(key)
        )
      );

      if (Object.keys(filtered).length === 0) {
        return '';
      }

      const jsonStr = JSON.stringify(filtered);
      return this.config.colorize
        ? `${COLORS.dim}${jsonStr}${COLORS.reset}`
        : jsonStr;
    } catch {
      return '';
    }
  }

  /**
   * Format event context for display
   */
  private formatContext(context: Record<string, any>): string {
    try {
      // Show only relevant context fields
      const relevant = Object.fromEntries(
        Object.entries(context).filter(([key, value]) => 
          value !== undefined && 
          ['sessionId', 'requestId', 'userId', 'workflowId'].includes(key)
        )
      );

      if (Object.keys(relevant).length === 0) {
        return '';
      }

      const contextStr = Object.entries(relevant)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');

      return this.config.colorize
        ? `${COLORS.dim}[${contextStr}]${COLORS.reset}`
        : `[${contextStr}]`;
    } catch {
      return '';
    }
  }

  /**
   * Update console configuration
   */
  public updateConfig(config: Partial<ConsoleTransportConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): ConsoleTransportConfig {
    return { ...this.config };
  }
}

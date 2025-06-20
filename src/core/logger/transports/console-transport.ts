/**
 * Console transport for outputting events to console
 */

import { Event, EventFilter, ConsoleTransportConfig } from '../types/index.js';
import { BaseFilteredEventTransport } from './base.js';

export class ConsoleTransport extends BaseFilteredEventTransport {
  private config: Required<ConsoleTransportConfig>;

  constructor(config: ConsoleTransportConfig = {}, filter?: EventFilter) {
    super(filter);
    
    this.config = {
      colorize: config.colorize ?? true,
      format: config.format ?? 'json',
      includeTimestamp: config.includeTimestamp ?? true,
    };
  }

  async sendMatchedEvent(event: Event): Promise<void> {
    const formatted = this.formatEvent(event);
    console.log(formatted);
  }

  /**
   * Format an event for console output
   */
  private formatEvent(event: Event): string {
    switch (this.config.format) {
      case 'text':
        return this.formatAsText(event);
      case 'pretty':
        return this.formatAsPretty(event);
      case 'json':
      default:
        return JSON.stringify(event);
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
   * Format event with basic pretty printing
   */
  private formatAsPretty(event: Event): string {
    const data = {
      timestamp: event.timestamp.toISOString(),
      type: event.type,
      namespace: event.namespace,
      name: event.name,
      message: event.message,
      data: event.data,
      context: event.context,
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Update transport configuration
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

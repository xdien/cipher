/**
 * Base transport implementations
 */

import { Event, EventFilter, EventTransport, FilteredEventTransport, EVENT_LEVELS } from '../types/index.js';

/**
 * Abstract base transport
 */
export abstract class BaseEventTransport implements EventTransport {
  abstract sendEvent(event: Event): Promise<void>;
}

/**
 * Abstract base filtered transport
 */
export abstract class BaseFilteredEventTransport extends BaseEventTransport implements FilteredEventTransport {
  public filter?: EventFilter;

  constructor(filter?: EventFilter) {
    super();
    this.filter = filter;
  }

  async sendEvent(event: Event): Promise<void> {
    if (!this.filter || this.matchesFilter(event)) {
      await this.sendMatchedEvent(event);
    }
  }

  abstract sendMatchedEvent(event: Event): Promise<void>;

  /**
   * Check if an event matches the configured filter
   */
  private matchesFilter(event: Event): boolean {
    if (!this.filter) {
      return true;
    }

    // Check event types
    if (this.filter.types && !this.filter.types.has(event.type)) {
      return false;
    }

    // Check event names
    if (this.filter.names && event.name && !this.filter.names.has(event.name)) {
      return false;
    }

    // Check namespaces
    if (this.filter.namespaces && !this.matchesNamespace(event.namespace)) {
      return false;
    }

    // Check minimum level
    if (this.filter.minLevel && !this.meetsMinLevel(event.type)) {
      return false;
    }

    return true;
  }

  /**
   * Check if event namespace matches any of the filter namespaces
   */
  private matchesNamespace(eventNamespace: string): boolean {
    if (!this.filter?.namespaces) {
      return true;
    }

    for (const filterNamespace of Array.from(this.filter.namespaces)) {
      // Exact match
      if (eventNamespace === filterNamespace) {
        return true;
      }
      
      // Prefix match (e.g., "app.service" matches "app.*")
      if (filterNamespace.endsWith('*')) {
        const prefix = filterNamespace.slice(0, -1);
        if (eventNamespace.startsWith(prefix)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if event type meets minimum level requirement
   */
  private meetsMinLevel(eventType: string): boolean {
    if (!this.filter?.minLevel) {
      return true;
    }

    const eventLevel = EVENT_LEVELS[eventType as keyof typeof EVENT_LEVELS];
    const minLevel = EVENT_LEVELS[this.filter.minLevel];

    return eventLevel >= minLevel;
  }

  /**
   * Update the filter for this transport
   */
  public setFilter(filter?: EventFilter): void {
    this.filter = filter;
  }

  /**
   * Get the current filter
   */
  public getFilter(): EventFilter | undefined {
    return this.filter;
  }
}

/**
 * No-operation transport (default)
 */
export class NoOpTransport extends BaseEventTransport {
  async sendEvent(_event: Event): Promise<void> {
    // Do nothing
  }
}

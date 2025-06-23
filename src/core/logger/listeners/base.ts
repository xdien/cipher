/**
 * Base listener classes providing common functionality
 */

import {
	Event,
	EventFilter,
	EventListener,
	LifecycleAwareListener,
	FilteredListener,
	EVENT_LEVELS,
} from '../types/index.js';

/**
 * Abstract base event listener
 */
export abstract class BaseEventListener implements EventListener {
	abstract handleEvent(event: Event): Promise<void>;
}

/**
 * Abstract base lifecycle-aware listener
 */
export abstract class BaseLifecycleAwareListener implements LifecycleAwareListener {
	protected started = false;

	async start(): Promise<void> {
		this.started = true;
	}

	async stop(): Promise<void> {
		this.started = false;
	}

	abstract handleEvent(event: Event): Promise<void>;

	protected isStarted(): boolean {
		return this.started;
	}
}

/**
 * Abstract base filtered listener with filtering logic
 */
export abstract class BaseFilteredListener
	extends BaseLifecycleAwareListener
	implements FilteredListener
{
	public filter?: EventFilter;

	constructor(filter?: EventFilter) {
		super();
		this.filter = filter;
	}

	async handleEvent(event: Event): Promise<void> {
		if (!this.isStarted()) {
			return;
		}

		if (!this.filter || this.matchesFilter(event)) {
			await this.handleMatchedEvent(event);
		}
	}

	abstract handleMatchedEvent(event: Event): Promise<void>;

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
	 * Update the filter for this listener
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

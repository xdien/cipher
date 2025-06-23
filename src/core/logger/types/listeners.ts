/**
 * Listener interfaces for the event-driven logging system
 */

import { Event, EventFilter } from './events.js';

export interface EventListener {
	handleEvent(event: Event): Promise<void>;
}

export interface LifecycleAwareListener extends EventListener {
	start(): Promise<void>;
	stop(): Promise<void>;
}

export interface FilteredListener extends LifecycleAwareListener {
	filter?: EventFilter;
	handleMatchedEvent(event: Event): Promise<void>;
}

/**
 * Configuration for batching listeners
 */
export interface BatchingConfig {
	batchSize: number;
	flushInterval: number; // milliseconds
	maxWaitTime: number; // milliseconds
}

export interface BatchingListener extends FilteredListener {
	config: BatchingConfig;
	flush(): Promise<void>;
}

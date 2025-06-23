/**
 * Core event types and interfaces for the logging system
 */

export type EventType = 'debug' | 'info' | 'warning' | 'error' | 'progress';

export interface EventContext {
	sessionId?: string;
	workflowId?: string;
	requestId?: string;
	userId?: string;
	[key: string]: any; // Allow additional properties
}

export interface Event {
	type: EventType;
	name?: string;
	namespace: string;
	message: string;
	timestamp: Date;
	data: Record<string, any> | null | undefined;
	context?: EventContext;
}

export interface EventFilter {
	types?: Set<EventType>;
	names?: Set<string>;
	namespaces?: Set<string>;
	minLevel?: EventType;
}

export interface SamplingFilter extends EventFilter {
	sampleRate: number;
}

/**
 * Event level hierarchy for filtering
 */
export const EVENT_LEVELS: Record<EventType, number> = {
	debug: 0,
	info: 1,
	warning: 2,
	error: 3,
	progress: 1, // Same level as info
} as const;

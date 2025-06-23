/**
 * JSON serialization utilities for logging
 */

/**
 * Safely serialize an object to JSON, handling circular references and errors
 */
export function safeJsonStringify(obj: any, space?: string | number): string {
	try {
		return JSON.stringify(obj, createCircularReplacer(), space);
	} catch (error) {
		return `[Serialization Error: ${error instanceof Error ? error.message : 'Unknown error'}]`;
	}
}

/**
 * Create a replacer function that handles circular references
 */
function createCircularReplacer() {
	const seen = new WeakSet();

	return (key: string, value: any) => {
		// Handle special types
		if (value instanceof Error) {
			return {
				name: value.name,
				message: value.message,
				stack: value.stack,
				...value,
			};
		}

		if (value instanceof Date) {
			return value.toISOString();
		}

		if (value instanceof RegExp) {
			return value.toString();
		}

		if (typeof value === 'function') {
			return `[Function: ${value.name || 'anonymous'}]`;
		}

		if (typeof value === 'bigint') {
			return value.toString() + 'n';
		}

		if (typeof value === 'symbol') {
			return value.toString();
		}

		if (typeof value === 'undefined') {
			return '[undefined]';
		}

		// Handle circular references
		if (typeof value === 'object' && value !== null) {
			if (seen.has(value)) {
				return '[Circular Reference]';
			}
			seen.add(value);
		}

		return value;
	};
}

/**
 * Sanitize sensitive data from objects before logging
 */
export function sanitizeForLogging(
	obj: any,
	sensitiveKeys: string[] = ['password', 'token', 'key', 'secret', 'auth']
): any {
	if (typeof obj !== 'object' || obj === null) {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map(item => sanitizeForLogging(item, sensitiveKeys));
	}

	const sanitized: any = {};

	for (const [key, value] of Object.entries(obj)) {
		const lowerKey = key.toLowerCase();
		const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive.toLowerCase()));

		if (isSensitive) {
			sanitized[key] = '[REDACTED]';
		} else if (typeof value === 'object' && value !== null) {
			sanitized[key] = sanitizeForLogging(value, sensitiveKeys);
		} else {
			sanitized[key] = value;
		}
	}

	return sanitized;
}

/**
 * Truncate large objects/strings for logging
 */
export function truncateForLogging(
	obj: any,
	maxStringLength: number = 1000,
	maxArrayLength: number = 100,
	maxObjectKeys: number = 50
): any {
	if (typeof obj === 'string') {
		return obj.length > maxStringLength
			? obj.substring(0, maxStringLength) + '...[truncated]'
			: obj;
	}

	if (Array.isArray(obj)) {
		const truncated = obj
			.slice(0, maxArrayLength)
			.map(item => truncateForLogging(item, maxStringLength, maxArrayLength, maxObjectKeys));

		if (obj.length > maxArrayLength) {
			truncated.push(`...[${obj.length - maxArrayLength} more items]`);
		}

		return truncated;
	}

	if (typeof obj === 'object' && obj !== null) {
		const keys = Object.keys(obj);
		const truncated: any = {};

		const keysToProcess = keys.slice(0, maxObjectKeys);

		for (const key of keysToProcess) {
			truncated[key] = truncateForLogging(obj[key], maxStringLength, maxArrayLength, maxObjectKeys);
		}

		if (keys.length > maxObjectKeys) {
			truncated['...[truncated]'] = `${keys.length - maxObjectKeys} more keys`;
		}

		return truncated;
	}

	return obj;
}

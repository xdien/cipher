import { Response } from 'express';

// Standard API response structure
export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
		details?: any;
	};
	meta?: {
		timestamp: string;
		requestId?: string;
	};
}

// Success response helper
export function successResponse<T>(
	res: Response,
	data: T,
	statusCode: number = 200,
	requestId?: string
): void {
	const response: ApiResponse<T> = {
		success: true,
		data,
		meta: {
			timestamp: new Date().toISOString(),
			...(requestId && { requestId })
		}
	};
	
	res.status(statusCode).json(response);
}

// Error response helper
export function errorResponse(
	res: Response,
	code: string,
	message: string,
	statusCode: number = 500,
	details?: any,
	requestId?: string
): void {
	const response: ApiResponse = {
		success: false,
		error: {
			code,
			message,
			details
		},
		meta: {
			timestamp: new Date().toISOString(),
			...(requestId && { requestId })
		}
	};
	
	res.status(statusCode).json(response);
}

// Common error codes
export const ERROR_CODES = {
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	NOT_FOUND: 'NOT_FOUND',
	UNAUTHORIZED: 'UNAUTHORIZED',
	INTERNAL_ERROR: 'INTERNAL_ERROR',
	BAD_REQUEST: 'BAD_REQUEST',
	SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
	MCP_SERVER_ERROR: 'MCP_SERVER_ERROR',
	LLM_ERROR: 'LLM_ERROR',
	RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const;

export type ErrorCode = keyof typeof ERROR_CODES; 
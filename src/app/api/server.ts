import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { MemAgent } from '@core/brain/memAgent/index.js';
import { logger } from '@core/logger/index.js';
import { errorResponse, ERROR_CODES } from './utils/response.js';
import {
	requestIdMiddleware,
	requestLoggingMiddleware,
	errorLoggingMiddleware,
} from './middleware/logging.js';

// Import route handlers
import { createMessageRoutes } from './routes/message.js';
import { createSessionRoutes } from './routes/session.js';
import { createMcpRoutes } from './routes/mcp.js';
import { createConfigRoutes } from './routes/config.js';
import { createLlmRoutes } from './routes/llm.js';

export interface ApiServerConfig {
	port: number;
	host?: string;
	corsOrigins?: string[];
	rateLimitWindowMs?: number;
	rateLimitMaxRequests?: number;
}

export class ApiServer {
	private app: Application;
	private agent: MemAgent;
	private config: ApiServerConfig;

	constructor(agent: MemAgent, config: ApiServerConfig) {
		this.agent = agent;
		this.config = config;
		this.app = express();
		this.setupMiddleware();
		this.setupRoutes();
		this.setupErrorHandling();
	}

	private setupMiddleware(): void {
		// Security middleware
		this.app.use(
			helmet({
				contentSecurityPolicy: false, // Disable CSP for API
				crossOriginEmbedderPolicy: false,
			})
		);

		// CORS configuration
		this.app.use(
			cors({
				origin: this.config.corsOrigins || ['http://localhost:3000'],
				methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
				allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
				credentials: true,
			})
		);

		// Rate limiting
		const limiter = rateLimit({
			windowMs: this.config.rateLimitWindowMs || 15 * 60 * 1000, // 15 minutes
			max: this.config.rateLimitMaxRequests || 100, // limit each IP to 100 requests per windowMs
			message: {
				success: false,
				error: {
					code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
					message: 'Too many requests from this IP, please try again later.',
				},
			},
			standardHeaders: true,
			legacyHeaders: false,
		});
		this.app.use('/api/', limiter);

		// Body parsing middleware
		this.app.use(express.json({ limit: '10mb' })); // Support for image data
		this.app.use(express.urlencoded({ extended: true }));

		// Custom middleware
		this.app.use(requestIdMiddleware);
		this.app.use(requestLoggingMiddleware);
	}

	private setupRoutes(): void {
		// Health check endpoint
		this.app.get('/health', (req: Request, res: Response) => {
			res.json({
				status: 'healthy',
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
				version: process.env.npm_package_version || 'unknown',
			});
		});

		// API routes
		this.app.use('/api/message', createMessageRoutes(this.agent));
		this.app.use('/api/sessions', createSessionRoutes(this.agent));
		this.app.use('/api/mcp', createMcpRoutes(this.agent));
		this.app.use('/api/llm', createLlmRoutes(this.agent));
		this.app.use('/api/config', createConfigRoutes(this.agent));

		// 404 handler for unknown routes
		this.app.use((req: Request, res: Response) => {
			errorResponse(
				res,
				ERROR_CODES.NOT_FOUND,
				`Route ${req.method} ${req.originalUrl} not found`,
				404,
				undefined,
				req.requestId
			);
		});
	}

	private setupErrorHandling(): void {
		// Error logging middleware
		this.app.use(errorLoggingMiddleware);

		// Global error handler
		this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
			// If response already sent, delegate to default Express error handler
			if (res.headersSent) {
				return next(err);
			}

			// Determine error type and status code
			let statusCode = 500;
			let errorCode: string = ERROR_CODES.INTERNAL_ERROR;

			if (err.name === 'ValidationError') {
				statusCode = 400;
				errorCode = ERROR_CODES.VALIDATION_ERROR;
			} else if (err.name === 'UnauthorizedError') {
				statusCode = 401;
				errorCode = ERROR_CODES.UNAUTHORIZED;
			}

			errorResponse(
				res,
				errorCode,
				err.message || 'An unexpected error occurred',
				statusCode,
				process.env.NODE_ENV === 'development' ? err.stack : undefined,
				req.requestId
			);
		});
	}

	public async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				const server = this.app.listen(this.config.port, this.config.host || 'localhost', () => {
					logger.info(
						`API Server started on ${this.config.host || 'localhost'}:${this.config.port}`,
						null,
						'green'
					);
					resolve();
				});

				server.on('error', err => {
					const errorMessage = err.message || err.toString() || 'Unknown error';
					logger.error('Failed to start API server:', errorMessage);
					logger.error('Error details:', err);
					reject(err);
				});

				// Graceful shutdown
				process.on('SIGTERM', () => {
					logger.info('SIGTERM received, shutting down API server gracefully');
					server.close(() => {
						logger.info('API server stopped');
						process.exit(0);
					});
				});

				process.on('SIGINT', () => {
					logger.info('SIGINT received, shutting down API server gracefully');
					server.close(() => {
						logger.info('API server stopped');
						process.exit(0);
					});
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	public getApp(): Application {
		return this.app;
	}
}

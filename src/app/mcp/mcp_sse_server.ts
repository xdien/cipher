import express, { Application, Request, Response } from 'express';
import http from 'http';
import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { SSEServerTransportOptions } from '@modelcontextprotocol/sdk/server/sse.js';
import { logger } from '@core/logger/index.js';

/**
 * Dedicated SSE server for MCP mode following the proper SSE transport specification.
 * Uses SSEServerTransport from the MCP SDK for correct Server-Sent Events implementation.
 */
export class McpSseServer {
	private app: Application;
	private httpServer?: http.Server;
	private mcpServer?: McpServer;
	private activeSseTransports: Map<string, SSEServerTransport> = new Map();
	private port: number;
	private host: string;
	private sseOptions?: SSEServerTransportOptions;
	private signalHandlers: Map<string, () => void> = new Map();
	private isShuttingDown: boolean = false;
	private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
	private readonly HEARTBEAT_INTERVAL = 25000; // 25 seconds - less than typical 30s timeout

	constructor(port: number, host: string = 'localhost', options?: SSEServerTransportOptions) {
		this.port = port;
		this.host = host;
		// Only assign when provided to satisfy exactOptionalPropertyTypes
		if (options) {
			this.sseOptions = options;
		}
		this.app = express();
		this.setupMiddleware();
	}

	/**
	 * Set up minimal middleware for SSE server
	 */
	private setupMiddleware(): void {
		// Minimal JSON parsing middleware
		this.app.use(express.json({ limit: '10mb' }));
		this.app.use(express.urlencoded({ extended: true }));

		// Set higher request timeout for SSE connections (SSE is long-lived)
		// Default Express timeout is 2 minutes, we set it to 10 minutes
		this.app.use((req: Request, res: Response, next) => {
			// SSE connections should have longer timeout
			req.socket.setTimeout(10 * 60 * 1000); // 10 minutes
			res.setTimeout(10 * 60 * 1000); // 10 minutes
			next();
		});

		// Basic error handling
		this.app.use((err: Error, req: Request, res: Response, _next: any) => {
			logger.error('[MCP SSE Server] Request error:', {
				error: err.message,
				path: req.path,
				method: req.method,
			});

			if (!res.headersSent) {
				res.status(500).json({
					error: 'Internal server error',
					message: err.message,
				});
			}
		});
	}

	/**
	 * Start the SSE server with the given MCP server instance
	 */
	async start(mcpServer: McpServer): Promise<void> {
		this.mcpServer = mcpServer;

		// Set up SSE routes
		this.setupSseRoutes();

		// Start HTTP server
		return new Promise((resolve, reject) => {
			this.httpServer = http.createServer(this.app);

			// Set higher timeout on the HTTP server
			this.httpServer.setTimeout(10 * 60 * 1000); // 10 minutes
			this.httpServer.keepAliveTimeout = 65 * 1000; // 65 seconds (>10 seconds keep-alive)

			this.httpServer.listen(this.port, this.host, () => {
				logger.info(`[MCP SSE Server] Started on ${this.host}:${this.port}`, null, 'green');
				logger.info(
					`[MCP SSE Server] SSE endpoint: http://${this.host}:${this.port}/sse`,
					null,
					'cyan'
				);
				logger.info(
					`[MCP SSE Server] Heartbeat interval: ${this.HEARTBEAT_INTERVAL}ms to prevent timeout`,
					null,
					'cyan'
				);
				resolve();
			});

			this.httpServer.on('error', err => {
				logger.error('[MCP SSE Server] Failed to start:', err.message);
				reject(err);
			});

			// Set up graceful shutdown handlers (prevent duplicate handlers)
			const sigTermHandler = () => this.stop();
			const sigIntHandler = () => this.stop();
			
			// Remove old handlers if they exist
			if (this.signalHandlers.has('SIGTERM')) {
				process.removeListener('SIGTERM', this.signalHandlers.get('SIGTERM')!);
			}
			if (this.signalHandlers.has('SIGINT')) {
				process.removeListener('SIGINT', this.signalHandlers.get('SIGINT')!);
			}
			
			// Add new handlers
			process.on('SIGTERM', sigTermHandler);
			process.on('SIGINT', sigIntHandler);
			
			// Store handlers for cleanup later
			this.signalHandlers.set('SIGTERM', sigTermHandler);
			this.signalHandlers.set('SIGINT', sigIntHandler);
		});
	}

	/**
	 * Stop the SSE server and clean up resources
	 */
	async stop(): Promise<void> {
		if (this.isShuttingDown) {
			logger.debug('[MCP SSE Server] Shutdown already in progress');
			return;
		}
		
		this.isShuttingDown = true;
		logger.info('[MCP SSE Server] Shutting down...');

		// Clear all heartbeat intervals
		for (const [sessionId, interval] of this.heartbeatIntervals) {
			logger.debug(`[MCP SSE Server] Clearing heartbeat for session: ${sessionId}`);
			clearInterval(interval);
		}
		this.heartbeatIntervals.clear();

		// Close all active SSE transports
		for (const [sessionId, transport] of this.activeSseTransports) {
			logger.debug(`[MCP SSE Server] Closing SSE transport for session: ${sessionId}`);
			try {
				transport.close();
			} catch (error) {
				logger.error(`[MCP SSE Server] Error closing transport ${sessionId}:`, error);
			}
		}
		this.activeSseTransports.clear();

		// Remove signal handlers to prevent memory leak
		for (const [signal, handler] of this.signalHandlers) {
			process.removeListener(signal, handler);
		}
		this.signalHandlers.clear();

		// Close HTTP server
		if (this.httpServer) {
			return new Promise(resolve => {
				this.httpServer!.close(() => {
					logger.info('[MCP SSE Server] Stopped');
					this.isShuttingDown = false;
					resolve();
				});
			});
		}
		
		this.isShuttingDown = false;
	}

	/**
	 * Start heartbeat for a specific SSE connection to prevent timeout
	 */
	private startHeartbeat(sessionId: string, res: Response): void {
		// Clear any existing heartbeat for this session
		if (this.heartbeatIntervals.has(sessionId)) {
			clearInterval(this.heartbeatIntervals.get(sessionId));
		}

		const heartbeatInterval = setInterval(() => {
			try {
				if (res.writableEnded) {
					logger.debug(`[MCP SSE Server] Response ended for session ${sessionId}, clearing heartbeat`);
					clearInterval(heartbeatInterval);
					this.heartbeatIntervals.delete(sessionId);
					return;
				}

				// Send a comment line (colon prefix) as keepalive
				// This is safe in SSE and doesn't affect client parsing
				res.write(': keepalive\n\n');
				logger.debug(`[MCP SSE Server] Heartbeat sent for session ${sessionId}`);
			} catch (error) {
				logger.debug(`[MCP SSE Server] Error sending heartbeat for session ${sessionId}:`, error);
				clearInterval(heartbeatInterval);
				this.heartbeatIntervals.delete(sessionId);
			}
		}, this.HEARTBEAT_INTERVAL);

		// Store the interval for cleanup
		this.heartbeatIntervals.set(sessionId, heartbeatInterval);
		logger.debug(`[MCP SSE Server] Heartbeat started for session ${sessionId}`);
	}

	/**
	 * Set up SSE routes following the proper SSE transport pattern
	 */
	private setupSseRoutes(): void {
		if (!this.mcpServer) {
			logger.error('[MCP SSE Server] MCP Server not initialized for SSE route setup.');
			return;
		}

		// GET /sse - Establish SSE connection (following SSE transport spec)
		this.app.get('/sse', (req: Request, res: Response) => {
			logger.info('[MCP SSE Server] New SSE client attempting connection.');
			logger.debug('[MCP SSE Server] SSE Request Headers:', req.headers);

			try {
				// Set SSE response headers
				res.setHeader('Content-Type', 'text/event-stream');
				res.setHeader('Cache-Control', 'no-cache');
				res.setHeader('Connection', 'keep-alive');
				res.setHeader('Access-Control-Allow-Origin', '*');

				// Set high socket timeout for long-lived SSE connections
				req.socket.setTimeout(10 * 60 * 1000); // 10 minutes

				// Create SSE transport instance with proper endpoint
				// The endpoint '/sse' is where clients will POST messages
				const sseTransport = new SSEServerTransport('/sse', res, this.sseOptions);
				logger.debug('[MCP SSE Server] SSEServerTransport created with endpoint /sse');

				// Connect MCP server to this SSE transport (this calls start() automatically)
				this.mcpServer?.connect(sseTransport);
				logger.debug('[MCP SSE Server] MCP server connected to SSE transport');

				// Store the transport keyed by its session ID
				this.activeSseTransports.set(sseTransport.sessionId, sseTransport);
				logger.info(
					`[MCP SSE Server] SSE client connected with session ID: ${sseTransport.sessionId}`
				);
				logger.debug(
					`[MCP SSE Server] Active SSE transports count: ${this.activeSseTransports.size}`
				);

				// Start heartbeat to keep connection alive
				this.startHeartbeat(sseTransport.sessionId, res);

				// Handle client disconnect - use 'once' to automatically clean up listener
				const closeHandler = () => {
					logger.info(
						`[MCP SSE Server] SSE client with session ID ${sseTransport.sessionId} disconnected.`
					);
					logger.debug('[MCP SSE Server] Cleaning up SSE transport and connection');
					
					// Clear heartbeat
					const heartbeatInterval = this.heartbeatIntervals.get(sseTransport.sessionId);
					if (heartbeatInterval) {
						clearInterval(heartbeatInterval);
						this.heartbeatIntervals.delete(sseTransport.sessionId);
					}

					try {
						sseTransport.close();
					} catch (error) {
						logger.error('[MCP SSE Server] Error closing transport:', error);
					}
					this.activeSseTransports.delete(sseTransport.sessionId);
					logger.debug(
						`[MCP SSE Server] Active SSE transports count after cleanup: ${this.activeSseTransports.size}`
					);
					// Explicitly remove listener to prevent memory leak
					req.removeListener('close', closeHandler);
				};
				
				// Use 'once' instead of 'on' to automatically remove listener
				req.once('close', closeHandler);

				// Handle transport errors
				sseTransport.onerror = (error: unknown) => {
					logger.error('[MCP SSE Server] SSE transport error:', error);
					
					// Clear heartbeat on error
					const heartbeatInterval = this.heartbeatIntervals.get(sseTransport.sessionId);
					if (heartbeatInterval) {
						clearInterval(heartbeatInterval);
						this.heartbeatIntervals.delete(sseTransport.sessionId);
					}

					this.activeSseTransports.delete(sseTransport.sessionId);
					// Also remove the close listener to prevent dangling listeners
					req.removeListener('close', closeHandler);
				};
			} catch (error) {
				logger.error('[MCP SSE Server] Error setting up SSE transport:', error);
				if (!res.headersSent) {
					res.status(500).json({
						error: 'Failed to establish SSE connection',
						message: error instanceof Error ? error.message : String(error),
					});
				}
			}
		});

		// POST /sse - Handle incoming messages (following SSE transport spec)
		this.app.post('/sse', async (req: Request, res: Response) => {
			logger.debug('[MCP SSE Server] SSE POST request received');
			logger.debug('[MCP SSE Server] POST Request Headers:', req.headers);
			logger.debug('[MCP SSE Server] POST Request Body:', req.body);

			// The SSEServerTransport handles session identification internally
			// We need to find the correct transport based on the request

			// For SSE transport, session identification can be via headers or query params
			let sessionId = (req.headers['x-session-id'] as string) || (req.query.sessionId as string);

			// If no explicit session ID, try to find the active transport
			// (In a typical SSE setup, there might be only one active connection)
			if (!sessionId && this.activeSseTransports.size === 1) {
				const firstId = Array.from(this.activeSseTransports.keys())[0];
				if (firstId) {
					sessionId = firstId;
				}
			}

			if (!sessionId) {
				logger.error('[MCP SSE Server] No session ID provided in SSE POST request');
				res.status(400).json({
					error: 'Bad Request',
					message: 'Session ID required for SSE POST requests',
				});
				return;
			}

			const sseTransport = this.activeSseTransports.get(sessionId);
			if (!sseTransport) {
				logger.error(`[MCP SSE Server] No active SSE transport found for session ID: ${sessionId}`);
				res.status(404).json({
					error: 'Not Found',
					message: `No active SSE session found for ID: ${sessionId}`,
				});
				return;
			}

			try {
				logger.debug(
					`[MCP SSE Server] Delegating POST message to SSE transport for session: ${sessionId}`
				);

				// Use the SSEServerTransport's built-in POST message handling
				await sseTransport.handlePostMessage(req, res, req.body);
				logger.debug(
					`[MCP SSE Server] POST message handled successfully for session: ${sessionId}`
				);
				return;
			} catch (error) {
				logger.error(
					`[MCP SSE Server] Error handling SSE POST request for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`
				);

				if (!res.headersSent) {
					res.status(500).json({
						error: 'Internal Server Error',
						message: 'Error processing SSE request',
						details: error instanceof Error ? error.message : String(error),
					});
				}
				return;
			}
		});

		logger.info(
			'[MCP SSE Server] SSE routes registered: GET /sse (establish connection), POST /sse (send messages)'
		);
	}

	/**
	 * Get the HTTP server instance
	 */
	getHttpServer(): http.Server | undefined {
		return this.httpServer;
	}

	/**
	 * Get server stats
	 */
	getStats() {
		return {
			port: this.port,
			host: this.host,
			transport: 'sse',
			activeSseTransports: this.activeSseTransports.size,
			sessionIds: Array.from(this.activeSseTransports.keys()),
			isRunning: !!this.httpServer,
			activeHeartbeats: this.heartbeatIntervals.size,
		};
	}

	/**
	 * Get active transport by session ID
	 */
	getTransport(sessionId: string): SSEServerTransport | undefined {
		return this.activeSseTransports.get(sessionId);
	}
}

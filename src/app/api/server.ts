import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { MemAgent } from '@core/brain/memAgent/index.js';
import { logger } from '@core/logger/index.js';
import { errorResponse, successResponse, ERROR_CODES } from './utils/response.js';
import {
	requestIdMiddleware,
	requestLoggingMiddleware,
	errorLoggingMiddleware,
} from './middleware/logging.js';
import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { initializeMcpServer, initializeAgentCardResource } from '@app/mcp/mcp_handler.js';

// Import WebSocket components
import { WebSocketConnectionManager } from './websocket/connection-manager.js';
import { WebSocketMessageRouter } from './websocket/message-router.js';
import { WebSocketEventSubscriber } from './websocket/event-subscriber.js';
import { WebSocketMessage, WebSocketConfig } from './websocket/types.js';

// Import route handlers
import { createMessageRoutes } from './routes/message.js';
import { createSessionRoutes } from './routes/session.js';
import { createMcpRoutes } from './routes/mcp.js';
import { createConfigRoutes } from './routes/config.js';
import { createLlmRoutes } from './routes/llm.js';
import { createSearchRoutes } from './routes/search.js';
import { createWebhookRoutes } from './routes/webhook.js';

export interface ApiServerConfig {
	port: number;
	host?: string;
	corsOrigins?: string[];
	rateLimitWindowMs?: number;
	rateLimitMaxRequests?: number;
	mcpTransportType?: 'stdio' | 'sse' | 'http';
	mcpPort?: number;
	// WebSocket configuration
	enableWebSocket?: boolean;
	webSocketConfig?: WebSocketConfig;
	// API prefix configuration
	apiPrefix?: string;
}

export class ApiServer {
	private app: Application;
	private agent: MemAgent;
	private config: ApiServerConfig;
	private apiPrefix: string;
	private mcpServer?: McpServer;
	private activeMcpSseTransports: Map<string, SSEServerTransport> = new Map();

	// WebSocket components
	private httpServer?: http.Server;
	private wss?: WebSocketServer;
	private wsConnectionManager?: WebSocketConnectionManager;
	private wsMessageRouter?: WebSocketMessageRouter;
	private wsEventSubscriber?: WebSocketEventSubscriber;
	private heartbeatInterval?: NodeJS.Timeout;

	constructor(agent: MemAgent, config: ApiServerConfig) {
		this.agent = agent;
		this.config = config;

		// Validate and set API prefix
		this.apiPrefix = this.validateAndNormalizeApiPrefix(config.apiPrefix);

		this.app = express();
		this.setupMiddleware();
		this.setupRoutes();
		this.setupErrorHandling();

		// Note: MCP setup is now handled in start() method to properly handle async operations
	}

	/**
	 * Validate and normalize API prefix configuration
	 */
	private validateAndNormalizeApiPrefix(prefix?: string): string {
		// Default to '/api' for backward compatibility
		if (prefix === undefined) {
			return '/api';
		}

		// Allow empty string to disable prefix
		if (prefix === '') {
			return '';
		}

		// Validate prefix format
		if (typeof prefix !== 'string') {
			throw new Error('API prefix must be a string');
		}

		// Ensure prefix starts with '/' if not empty
		if (!prefix.startsWith('/')) {
			prefix = '/' + prefix;
		}

		// Remove trailing slash to normalize
		if (prefix.endsWith('/') && prefix !== '/') {
			prefix = prefix.slice(0, -1);
		}

		logger.info(`[API Server] Using API prefix: '${prefix || '(none)'}'`);
		return prefix;
	}

	/**
	 * Helper method to construct API route paths
	 */
	private buildApiRoute(route: string): string {
		if (!this.apiPrefix || this.apiPrefix === '') {
			return route;
		}
		return `${this.apiPrefix}${route}`;
	}

	/**
	 * Helper method to construct full path including proxy context path
	 * Used for SSE transport endpoint configuration when behind reverse proxy
	 */
	private buildFullPath(req: Request, path: string): string {
		const contextPath = (req as any).contextPath || '';
		const fullPath = contextPath + this.buildApiRoute(path);

		logger.debug('[API Server] Built full path', {
			path,
			contextPath,
			apiPrefix: this.apiPrefix,
			fullPath,
		});

		return fullPath;
	}

	private async setupMcpServer(
		transportType: 'stdio' | 'sse' | 'http',
		_port?: number
	): Promise<void> {
		logger.info(`[API Server] Setting up MCP server with transport type: ${transportType}`);
		try {
			// Initialize agent card data
			const agentCard = this.agent.getEffectiveConfig().agentCard;
			const agentCardInput = agentCard
				? Object.fromEntries(Object.entries(agentCard).filter(([, value]) => value !== undefined))
				: {};
			const agentCardData = initializeAgentCardResource(agentCardInput);

			// Check MCP_SERVER_MODE environment variable to determine server type
			const mcpServerMode = process.env.MCP_SERVER_MODE || 'default';
			logger.info(`[API Server] MCP server mode: ${mcpServerMode}`);

			// Load aggregator configuration if needed
			let aggregatorConfig: any = undefined;
			if (mcpServerMode === 'aggregator') {
				aggregatorConfig = await this.loadAggregatorConfig();
			}

			// Initialize MCP server instance with appropriate mode
			this.mcpServer = await initializeMcpServer(
				this.agent,
				agentCardData,
				mcpServerMode as 'default' | 'aggregator',
				aggregatorConfig
			);

			if (transportType === 'sse') {
				this.setupMcpSseRoutes(); // Renamed for clarity as it sets up both GET and POST
			} else if (transportType === 'stdio') {
				// For stdio, we need to explicitly connect the server to a StdioServerTransport
				// This usually means the process runs as a standalone MCP server, not integrated into Express
				// This case is typically handled by the CLI directly, not via ApiServer
				logger.warn(
					`[API Server] MCP transport type 'stdio' is typically handled by the CLI directly and not integrated into the API server.`
				);
				// If a StdioServerTransport needs to be managed by ApiServer, its lifecycle would be handled here.
				// For now, we assume 'stdio' mode implies a different execution path.
			} else {
				logger.warn(
					`[API Server] MCP transport type '${transportType}' not fully implemented for API server integration yet.`
				);
			}
		} catch (error) {
			logger.error(
				`[API Server] Failed to set up MCP server: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Load aggregator configuration from environment variables
	 * Aggregator mode now uses agent's unifiedToolManager which automatically includes MCP servers from cipher.yml
	 */
	private async loadAggregatorConfig(): Promise<any> {
		const defaultConfig = {
			type: 'aggregator' as const,
			servers: {}, // No longer needed - using unifiedToolManager
			conflictResolution: (process.env.AGGREGATOR_CONFLICT_RESOLUTION as any) || 'prefix',
			autoDiscovery: false,
			timeout: parseInt(process.env.AGGREGATOR_TIMEOUT || '60000'),
			connectionMode: 'lenient' as const,
		};

		logger.info('[API Server] Using aggregator configuration with env vars', {
			conflictResolution: defaultConfig.conflictResolution,
			timeout: defaultConfig.timeout,
		});
		return defaultConfig;
	}

	private setupMcpSseRoutes(): void {
		if (!this.mcpServer) {
			logger.error('[API Server] MCP Server not initialized for SSE route setup.');
			return;
		}

		// Handle SSE GET endpoint (for client to establish SSE connection)
		this.app.get(this.buildApiRoute('/mcp/sse'), (req: Request, res: Response) => {
			logger.info('[API Server] New MCP SSE client attempting connection.');
			logger.debug('[API Server] SSE Request Headers:', req.headers);
			logger.debug('[API Server] SSE Request URL:', req.url);
			logger.debug('[API Server] SSE Request Original URL:', req.originalUrl);

			try {
				// Set SSE response headers
				res.setHeader('Content-Type', 'text/event-stream');
				res.setHeader('Cache-Control', 'no-cache');
				res.setHeader('Connection', 'keep-alive');
				res.setHeader('Access-Control-Allow-Origin', '*');

				// Set high socket timeout for long-lived SSE connections
				req.socket.setTimeout(10 * 60 * 1000); // 10 minutes

				// Build the POST endpoint path including context path from proxy
				const postEndpoint = this.buildFullPath(req, '/mcp');

				logger.info(`[API Server] Creating SSE transport with POST endpoint: ${postEndpoint}`);

				// Create SSE transport instance with the full path
				const sseTransport = new SSEServerTransport(postEndpoint, res);

				// Log the session ID for debugging
				logger.info(`[API Server] SSE session created with ID: ${sseTransport.sessionId}`);
				logger.info(
					`[API Server] Client should POST to: ${postEndpoint}?sessionId=${sseTransport.sessionId}`
				);

				// Connect MCP server to this SSE transport (this will call sseTransport.start() and set headers)
				this.mcpServer?.connect(sseTransport);
				logger.debug('[API Server] MCP server connected to SSE transport');

				// Store the transport keyed by its session ID
				this.activeMcpSseTransports.set(sseTransport.sessionId, sseTransport);
				logger.info(
					`[API Server] MCP SSE client connected with session ID: ${sseTransport.sessionId}`
				);
				logger.debug(
					`[API Server] Active SSE transports count: ${this.activeMcpSseTransports.size}`
				);

				// Start heartbeat to keep connection alive (25 seconds interval)
				const heartbeatInterval = setInterval(() => {
					try {
						if (res.writableEnded) {
							logger.debug(
								`[API Server] Response ended for session ${sseTransport.sessionId}, clearing heartbeat`
							);
							clearInterval(heartbeatInterval);
							return;
						}

						// Send a comment line (colon prefix) as keepalive
						// This is safe in SSE and doesn't affect client parsing
						res.write(': keepalive\n\n');
						logger.debug(`[API Server] Heartbeat sent for session ${sseTransport.sessionId}`);
					} catch (error) {
						logger.debug(
							`[API Server] Error sending heartbeat for session ${sseTransport.sessionId}:`,
							error
						);
						clearInterval(heartbeatInterval);
					}
				}, 25000); // 25 seconds - less than typical 30s timeout

				// Handle client disconnect
				const closeHandler = () => {
					logger.info(
						`[API Server] MCP SSE client with session ID ${sseTransport.sessionId} disconnected.`
					);
					logger.debug('[API Server] Cleaning up SSE transport and connection');
					
					// Clear heartbeat
					clearInterval(heartbeatInterval);

					try {
						sseTransport.close(); // Close the transport when client disconnects
					} catch (error) {
						logger.error('[API Server] Error closing SSE transport:', error);
					}
					this.activeMcpSseTransports.delete(sseTransport.sessionId); // Remove from active transports
					logger.debug(
						`[API Server] Active SSE transports count after cleanup: ${this.activeMcpSseTransports.size}`
					);
					// Explicitly remove listener to prevent memory leak
					req.removeListener('close', closeHandler);
				};

				// Use 'once' instead of 'on' to automatically remove listener
				req.once('close', closeHandler);

				// Handle transport errors
				sseTransport.onerror = (error: unknown) => {
					logger.error('[API Server] SSE transport error:', error);
					// Clear heartbeat on error
					clearInterval(heartbeatInterval);
					this.activeMcpSseTransports.delete(sseTransport.sessionId);
					// Also remove the close listener to prevent dangling listeners
					req.removeListener('close', closeHandler);
				};
			} catch (error) {
				logger.error('[API Server] Error setting up SSE transport:', error);
				if (!res.headersSent) {
					res.status(500).json({
						error: 'Failed to establish SSE connection',
						message: error instanceof Error ? error.message : String(error),
					});
				}
			}
		});

		// Handle POST requests for MCP messages over HTTP (part of Streamable HTTP)
		this.app.post(this.buildApiRoute('/mcp'), async (req: Request, res: Response) => {
			logger.debug('[API Server] MCP POST request received');
			logger.debug('[API Server] POST Request Headers:', req.headers);
			logger.debug('[API Server] POST Request Body:', req.body);
			logger.debug('[API Server] POST Request Query:', req.query);
			logger.debug('[API Server] POST Request Original URL:', req.originalUrl);

			if (!this.mcpServer) {
				logger.error('[API Server] MCP Server not initialized for POST route.');
				return errorResponse(res, ERROR_CODES.INTERNAL_ERROR, 'MCP Server not ready', 500);
			}

			// Try multiple ways to get session ID (query param, header, body)
			const sessionId =
				(req.query.sessionId as string) ||
				(req.headers['x-session-id'] as string) ||
				(req.body.sessionId as string);

			if (!sessionId) {
				logger.error('[API Server] MCP POST request received without session ID.');
				logger.debug('[API Server] Available query parameters:', Object.keys(req.query));
				logger.debug('[API Server] Available headers:', Object.keys(req.headers));
				logger.debug(
					'[API Server] Active sessions:',
					Array.from(this.activeMcpSseTransports.keys())
				);

				return errorResponse(
					res,
					ERROR_CODES.BAD_REQUEST,
					'Missing sessionId in query parameters, headers, or body. Session ID is required for security.',
					400
				);
			}

			logger.debug(`[API Server] Looking for SSE transport with session ID: ${sessionId}`);
			logger.debug(
				`[API Server] Available session IDs: ${Array.from(this.activeMcpSseTransports.keys()).join(', ')}`
			);

			const sseTransport = this.activeMcpSseTransports.get(sessionId);

			if (!sseTransport) {
				logger.error(`[API Server] No active MCP SSE transport found for session ID: ${sessionId}`);
				return errorResponse(
					res,
					ERROR_CODES.NOT_FOUND,
					`No active session found for ID: ${sessionId}`,
					404
				);
			}

			try {
				logger.debug(
					`[API Server] Delegating POST message to SSE transport for session: ${sessionId}`
				);
				// Delegate handling of the POST message to the specific SSEServerTransport instance
				// Pass req.body as the third parameter since Express has already parsed it
				await sseTransport.handlePostMessage(req, res, req.body);
				logger.debug(`[API Server] POST message handled successfully for session: ${sessionId}`);
			} catch (error) {
				logger.error(
					`[API Server] Error handling MCP POST request for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`
				);
				logger.debug(
					`[API Server] POST error stack:`,
					error instanceof Error ? error.stack : 'No stack available'
				);
				errorResponse(
					res,
					ERROR_CODES.INTERNAL_ERROR,
					'Error processing MCP request',
					500,
					error instanceof Error ? error.stack : undefined
				);
			}
		});

		const mcpSseRoute = this.buildApiRoute('/mcp/sse');
		const mcpPostRoute = this.buildApiRoute('/mcp');
		logger.info(
			`[API Server] MCP SSE (GET ${mcpSseRoute}) and POST (${mcpPostRoute}?sessionId=...) routes registered.`
		);
	}

	/**
	 * Set up WebSocket server and event handling
	 */
	private setupWebSocket(): void {
		if (!this.config.enableWebSocket || !this.httpServer) {
			logger.debug('[API Server] WebSocket disabled or HTTP server not available');
			return;
		}

		const wsConfig = this.config.webSocketConfig || {};

		// Create WebSocket server
		this.wss = new WebSocketServer({
			server: this.httpServer,
			path: wsConfig.path || '/ws',
			...(wsConfig.maxConnections && { maxClients: wsConfig.maxConnections }),
			...(wsConfig.enableCompression !== undefined && {
				perMessageDeflate: wsConfig.enableCompression,
			}),
		});

		// Initialize WebSocket components
		this.wsConnectionManager = new WebSocketConnectionManager(
			wsConfig.maxConnections || 1000,
			wsConfig.connectionTimeout || 300000
		);

		this.wsMessageRouter = new WebSocketMessageRouter(this.agent, this.wsConnectionManager);

		this.wsEventSubscriber = new WebSocketEventSubscriber(
			this.wsConnectionManager,
			this.agent.services.eventManager
		);

		// Wire up the connection manager to notify the event subscriber
		this.wsConnectionManager.setEventSubscriber(this.wsEventSubscriber);

		// Set up WebSocket connection handler
		this.wss.on('connection', (ws: WebSocket, request) => {
			this.handleWebSocketConnection(ws, request);
		});

		// Start event subscription
		this.wsEventSubscriber.subscribe();

		// Set up heartbeat if configured
		if (wsConfig.heartbeatInterval && wsConfig.heartbeatInterval > 0) {
			this.heartbeatInterval = setInterval(() => {
				this.wsConnectionManager?.sendHeartbeat();
			}, wsConfig.heartbeatInterval);
		}

		// Set up graceful shutdown handling
		process.on('SIGTERM', () => {
			this.shutdownWebSocket();
		});

		process.on('SIGINT', () => {
			this.shutdownWebSocket();
		});

		logger.info('[API Server] WebSocket server initialized', {
			path: wsConfig.path || '/ws',
			maxConnections: wsConfig.maxConnections || 1000,
			compression: wsConfig.enableCompression !== false,
			heartbeat: wsConfig.heartbeatInterval || 'disabled',
		});
	}

	/**
	 * Handle new WebSocket connection
	 */
	private handleWebSocketConnection(ws: WebSocket, request: http.IncomingMessage): void {
		try {
			// Extract session ID from query parameters if provided
			const url = new URL(request.url || '', `http://${request.headers.host}`);
			const sessionId = url.searchParams.get('sessionId') || undefined;

			// Add connection to manager
			const connectionId = this.wsConnectionManager!.addConnection(ws, sessionId);

			logger.info('[API Server] New WebSocket connection established', {
				connectionId,
				sessionId,
				origin: request.headers.origin,
				userAgent: request.headers['user-agent'],
			});

			// Set up message handler
			ws.on('message', async (data: Buffer) => {
				try {
					const message = JSON.parse(data.toString()) as WebSocketMessage;
					await this.wsMessageRouter!.routeMessage(ws, connectionId, message);
				} catch (error) {
					logger.error('[API Server] Error parsing WebSocket message', {
						connectionId,
						error: error instanceof Error ? error.message : String(error),
						rawData: data.toString().substring(0, 200), // Log first 200 chars
					});

					// Send error response
					if (ws.readyState === WebSocket.OPEN) {
						ws.send(
							JSON.stringify({
								event: 'error',
								error: 'Invalid message format',
								data: {
									message: 'Failed to parse JSON message',
									code: 'INVALID_JSON',
								},
								timestamp: Date.now(),
							})
						);
					}
				}
			});

			// Send welcome message
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(
					JSON.stringify({
						event: 'connected',
						data: {
							connectionId,
							sessionId,
							serverVersion: process.env.npm_package_version || 'unknown',
							capabilities: ['streaming', 'tools', 'memory', 'reset'],
						},
						timestamp: Date.now(),
					})
				);
			}
		} catch (error) {
			logger.error('[API Server] Error handling WebSocket connection', {
				error: error instanceof Error ? error.message : String(error),
				origin: request.headers.origin,
			});

			if (ws.readyState === WebSocket.OPEN) {
				ws.close(1011, 'Server error during connection setup');
			}
		}
	}

	/**
	 * Shutdown WebSocket server gracefully
	 */
	private shutdownWebSocket(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
		}

		if (this.wsEventSubscriber) {
			this.wsEventSubscriber.dispose();
		}

		if (this.wsConnectionManager) {
			this.wsConnectionManager.dispose();
		}

		if (this.wss) {
			this.wss.close(() => {
				logger.info('[API Server] WebSocket server closed');
			});
		}
	}

	private setupMiddleware(): void {
		// Enable trust proxy for reverse proxy support
		this.app.set('trust proxy', true);

		// Parse X-Forwarded-Prefix for context path support
		this.app.use((req: Request, res: Response, next: NextFunction) => {
			// Get the prefix from X-Forwarded-Prefix header or environment variable
			const forwardedPrefix = req.headers['x-forwarded-prefix'] as string;
			const envPrefix = process.env.PROXY_CONTEXT_PATH;
			const contextPath = forwardedPrefix || envPrefix || '';

			// Store context path on request for later use
			(req as any).contextPath = contextPath;

			logger.debug('[API Server] Request context', {
				originalUrl: req.originalUrl,
				contextPath,
				forwardedPrefix,
				forwardedProto: req.headers['x-forwarded-proto'],
				forwardedHost: req.headers['x-forwarded-host'],
			});

			next();
		});

		// Security middleware
		this.app.use(
			helmet({
				contentSecurityPolicy: false, // Disable CSP for API
				crossOriginEmbedderPolicy: false,
			})
		);

		// CORS configuration - enhanced for reverse proxy support
		this.app.use(
			cors({
				origin: (origin, callback) => {
					const allowedOrigins = this.config.corsOrigins || ['http://localhost:3000'];

					// Allow requests with no origin (e.g., mobile apps, curl, Postman)
					if (!origin) {
						callback(null, true);
						return;
					}

					// Check if origin is in the allowed list
					if (allowedOrigins.includes(origin)) {
						callback(null, true);
						return;
					}

					// Additional lenient check for development environments only
					// Allow localhost and 127.0.0.1 with any port in development
					if (process.env.NODE_ENV !== 'production') {
						const originUrl = new URL(origin);
						if (
							originUrl.hostname === 'localhost' ||
							originUrl.hostname === '127.0.0.1' ||
							originUrl.hostname === '::1'
						) {
							callback(null, true);
							return;
						}
					}

					// Reject all other origins
					callback(new Error('Not allowed by CORS'));
				},
				methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
				allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Session-ID'],
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
		// Apply rate limiting to API routes if prefix is configured
		if (this.apiPrefix) {
			this.app.use(`${this.apiPrefix}/`, limiter);
		}

		// Body parsing middleware
		this.app.use(express.json({ limit: '10mb' })); // Support for image data
		this.app.use(express.urlencoded({ extended: true }));

		// Custom middleware
		this.app.use(requestIdMiddleware);
		this.app.use(requestLoggingMiddleware);
	}

	private setupRoutes(): void {
		// Health check endpoint
		this.app.get('/health', (_req: Request, res: Response) => {
			const healthData: any = {
				status: 'healthy',
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
				version: process.env.npm_package_version || 'unknown',
			};

			// Add WebSocket health if enabled
			if (this.config.enableWebSocket) {
				healthData.websocket = {
					enabled: true,
					active: this.isWebSocketActive(),
					stats: this.getWebSocketStats(),
				};
			}

			res.json(healthData);
		});

		// WebSocket stats endpoint
		this.app.get('/ws/stats', (_req: Request, res: Response) => {
			if (!this.config.enableWebSocket) {
				return res.status(404).json({
					success: false,
					error: {
						code: 'WEBSOCKET_DISABLED',
						message: 'WebSocket is not enabled',
					},
				});
			}

			const stats = this.getWebSocketStats();
			return res.json({
				success: true,
				data: {
					enabled: true,
					active: this.isWebSocketActive(),
					...stats,
				},
			});
		});

		// API routes
		this.app.use(this.buildApiRoute('/message'), createMessageRoutes(this.agent));
		this.app.use(this.buildApiRoute('/sessions'), createSessionRoutes(this.agent));
		this.app.use(this.buildApiRoute('/mcp'), createMcpRoutes(this.agent));
		this.app.use(this.buildApiRoute('/llm'), createLlmRoutes(this.agent));
		this.app.use(this.buildApiRoute('/config'), createConfigRoutes(this.agent));
		this.app.use(this.buildApiRoute('/search'), createSearchRoutes(this.agent));
		this.app.use(this.buildApiRoute('/webhooks'), createWebhookRoutes(this.agent));

		// Legacy endpoint for MCP server connection
		this.app.post(this.buildApiRoute('/connect-server'), (req: Request, res: Response) => {
			// Forward to MCP routes
			req.url = '/servers';
			createMcpRoutes(this.agent)(req, res, () => {});
		});

		// Chrome DevTools compatibility endpoint (prevents 404 errors in console)
		this.app.get(
			'/.well-known/appspecific/com.chrome.devtools.json',
			(req: Request, res: Response) => {
				res.status(204).end(); // No Content - indicates no DevTools integration available
			}
		);

		// A2A (Agent-to-Agent) discovery endpoint
		this.app.get('/.well-known/agent.json', (req: Request, res: Response) => {
			try {
				const agentCard = {
					name: 'Cipher Agent',
					description: 'Memory-powered AI agent framework with real-time communication',
					version: process.env.npm_package_version || '1.0.0',
					capabilities: ['conversation', 'memory', 'tools', 'mcp', 'websocket', 'streaming'],
					endpoints: {
						base: `${req.protocol}://${req.get('host')}`,
						api: `${req.protocol}://${req.get('host')}${this.apiPrefix || ''}`,
						websocket: `ws://${req.get('host')}/ws`,
						health: `${req.protocol}://${req.get('host')}/health`,
					},
					contact: {
						support: 'https://github.com/byterover/cipher',
					},
					protocols: ['http', 'websocket', 'mcp'],
					timestamp: new Date().toISOString(),
				};

				res.json(agentCard);
			} catch (error) {
				logger.error('Failed to generate agent card', {
					requestId: req.requestId,
					error: error instanceof Error ? error.message : String(error),
				});

				errorResponse(
					res,
					ERROR_CODES.INTERNAL_ERROR,
					'Failed to generate agent discovery data',
					500,
					undefined,
					req.requestId
				);
			}
		});

		// Global reset endpoint
		this.app.post(this.buildApiRoute('/reset'), async (req: Request, res: Response) => {
			try {
				const { sessionId } = req.body;

				logger.info('Processing global reset request', {
					requestId: req.requestId,
					sessionId: sessionId || 'all',
				});

				if (sessionId) {
					// Reset specific session
					const success = await this.agent.removeSession(sessionId);
					if (!success) {
						return errorResponse(
							res,
							ERROR_CODES.SESSION_NOT_FOUND,
							`Session ${sessionId} not found`,
							404,
							undefined,
							req.requestId
						);
					}
				} else {
					// Reset all sessions
					const sessionIds = await this.agent.listSessions();
					for (const id of sessionIds) {
						await this.agent.removeSession(id);
					}
				}

				successResponse(
					res,
					{
						message: sessionId ? `Session ${sessionId} reset` : 'All sessions reset',
						timestamp: new Date().toISOString(),
					},
					200,
					req.requestId
				);
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				logger.error('Global reset failed', {
					requestId: req.requestId,
					error: errorMsg,
				});

				errorResponse(
					res,
					ERROR_CODES.INTERNAL_ERROR,
					`Reset failed: ${errorMsg}`,
					500,
					process.env.NODE_ENV === 'development' ? error : undefined,
					req.requestId
				);
			}
		});
		// Note: 404 handler moved to setup404Handler() and called after MCP routes setup
	}

	private setup404Handler(): void {
		// 404 handler for unknown routes - must be registered AFTER all other routes
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
		// Set up MCP server BEFORE starting HTTP server if transport type is provided
		if (this.config.mcpTransportType) {
			try {
				await this.setupMcpServer(this.config.mcpTransportType, this.config.mcpPort);
				logger.info(`[API Server] MCP server setup completed successfully`);
			} catch (error) {
				logger.error(
					`[API Server] Failed to setup MCP server: ${error instanceof Error ? error.message : String(error)}`
				);
				throw error;
			}
		}

		// Set up 404 handler AFTER all routes (including MCP) are registered
		this.setup404Handler();

		return new Promise((resolve, reject) => {
			try {
				// Create HTTP server from Express app
				this.httpServer = http.createServer(this.app);

				// Set up WebSocket server if enabled
				if (this.config.enableWebSocket) {
					this.setupWebSocket();
				}

				this.httpServer.listen(this.config.port, this.config.host || 'localhost', () => {
					logger.info(
						`API Server started on ${this.config.host || 'localhost'}:${this.config.port}`,
						null,
						'green'
					);
					if (this.config.mcpTransportType) {
						const mcpSseEndpoint = this.buildApiRoute('/mcp/sse');
						const mcpEndpoint = this.buildApiRoute('/mcp');
						logger.info(
							`[API Server] MCP SSE endpoints available at ${mcpSseEndpoint} and ${mcpEndpoint}`,
							null,
							'green'
						);
					}
					if (this.config.enableWebSocket) {
						const wsPath = this.config.webSocketConfig?.path || '/ws';
						logger.info(
							`[API Server] WebSocket server available at ws://${this.config.host || 'localhost'}:${this.config.port}${wsPath}`,
							null,
							'green'
						);
					}
					resolve();
				});

				this.httpServer.on('error', err => {
					const errorMessage = err.message || err.toString() || 'Unknown error';
					logger.error('Failed to start API server:', errorMessage);
					logger.error('Error details:', err);
					reject(err);
				});

				// Graceful shutdown
				process.on('SIGTERM', () => {
					logger.info('SIGTERM received, shutting down API server gracefully');
					this.shutdownWebSocket();
					this.httpServer?.close(() => {
						logger.info('API server stopped');
						process.exit(0);
					});
				});

				process.on('SIGINT', () => {
					logger.info('SIGINT received, shutting down API server gracefully');
					this.shutdownWebSocket();
					this.httpServer?.close(() => {
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

	/**
	 * Get WebSocket statistics
	 */
	public getWebSocketStats(): any {
		if (!this.wsConnectionManager || !this.wsEventSubscriber) {
			return null;
		}

		return {
			connections: this.wsConnectionManager.getStats(),
			events: this.wsEventSubscriber.getStats(),
			router: this.wsMessageRouter?.getStats(),
		};
	}

	/**
	 * Send system message to all WebSocket connections
	 */
	public broadcastSystemMessage(
		message: string,
		level: 'info' | 'warning' | 'error' = 'info'
	): void {
		if (this.wsEventSubscriber) {
			this.wsEventSubscriber.sendSystemMessage(message, level);
		}
	}

	/**
	 * Check if WebSocket is enabled and active
	 */
	public isWebSocketActive(): boolean {
		return !!(this.config.enableWebSocket && this.wss && this.wsEventSubscriber?.isActive());
	}
}

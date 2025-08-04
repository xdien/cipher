import { Router, Request, Response } from 'express';
import { MemAgent } from '@core/brain/memAgent/index.js';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/response.js';
import {
	validateSessionId,
	validateCreateSession,
	validateListParams,
} from '../middleware/validation.js';
import { logger } from '@core/logger/index.js';

export function createSessionRoutes(agent: MemAgent): Router {
	const router = Router();

	/**
	 * GET /api/sessions
	 * List all active sessions with metadata
	 */
	router.get('/', validateListParams, async (req: Request, res: Response) => {
		try {
			logger.info('Listing sessions', { requestId: req.requestId });

			const sessionIds = await agent.listSessions();
			const sessions = [];
			const processedSessionIds = new Set<string>();

			// First, get all active sessions with their current metadata
			for (const sessionId of sessionIds) {
				const metadata = await agent.getSessionMetadata(sessionId);
				if (metadata) {
					// Ensure message count is available for active sessions
					let messageCount = metadata.messageCount || 0;
					
					// If no message count, try to get it from session history
					if (messageCount === 0) {
						try {
							const history = await agent.getSessionHistory(sessionId);
							messageCount = history.length;
						} catch (error) {
							logger.debug(`Failed to get history for active session ${sessionId}:`, error);
						}
					}
					
					sessions.push({
						...metadata,
						messageCount
					});
					processedSessionIds.add(sessionId);
				}
			}

			// Also check for sessions with conversation history in the database
			try {
				// Get the storage manager from the agent's session manager
				const sessionManager = agent.sessionManager;
				let storageManager = sessionManager.getStorageManagerForSession('default');
				
				// If no storage manager from default session, try to get the shared one
				if (!storageManager) {
					// Access the session manager's storage directly
					try {
						// Get storage manager from session manager instance
						const backends = (sessionManager as any).storageManager?.getBackends?.();
						if (backends) {
							storageManager = { getBackends: () => backends };
						}
					} catch (error) {
						logger.debug('Could not access session manager storage:', error);
					}
				}
				
				if (storageManager && storageManager.getBackends) {
					const backends = storageManager.getBackends();
					if (backends && backends.database) {
						// Look for both conversation history and persisted sessions
						const messageKeys = await backends.database.list('messages:');
						const sessionKeys = await backends.database.list('session:');
						
						// Process conversation history keys
						for (const key of messageKeys) {
							// Extract session ID from the key (remove 'messages:' prefix)
							const sessionId = key.replace('messages:', '');
							
							// Skip if this session is already processed
							if (processedSessionIds.has(sessionId)) {
								// Update message count for existing active session
								const existingSession = sessions.find(s => s.id === sessionId);
								if (existingSession && existingSession.messageCount === 0) {
									try {
										const historyData = await backends.database.get(key);
										if (historyData && Array.isArray(historyData)) {
											existingSession.messageCount = historyData.length;
											logger.debug(`Updated message count for active session ${sessionId}: ${historyData.length}`);
										}
									} catch (error) {
										logger.warn(`Failed to get message count for active session ${sessionId}:`, error);
									}
								}
								continue;
							}
							
							try {
								// Get the conversation history to count messages
								const historyData = await backends.database.get(key);
								if (historyData && Array.isArray(historyData)) {
									const messageCount = historyData.length;
									
									// Try to get session metadata from persisted session if available
									let sessionMetadata = {
										id: sessionId,
										createdAt: Date.now() - (messageCount * 60000), // Approximate creation time
										lastActivity: Date.now(),
										messageCount: messageCount
									};
									
									// Try to get more accurate metadata from persisted session
									const sessionKey = `session:${sessionId}`;
									try {
										const persistedSession = await backends.database.get(sessionKey);
										if (persistedSession && persistedSession.metadata) {
											sessionMetadata = {
												id: sessionId,
												createdAt: persistedSession.metadata.createdAt || sessionMetadata.createdAt,
												lastActivity: persistedSession.metadata.lastActivity || sessionMetadata.lastActivity,
												messageCount: messageCount
											};
										}
									} catch (sessionError) {
										// Continue with approximate metadata if persisted session data is not available
										logger.debug(`Could not retrieve persisted session metadata for ${sessionId}:`, sessionError);
									}
									
									sessions.push(sessionMetadata);
									processedSessionIds.add(sessionId);
									logger.info(`Found persisted session with conversation history: ${sessionId} (${messageCount} messages)`);
								}
							} catch (error) {
								logger.warn(`Failed to process session ${sessionId} from database:`, error);
							}
						}
					}
				}
			} catch (error) {
				logger.warn('Failed to load sessions from database:', error);
			}

			successResponse(res, {
				sessions,
				count: sessions.length,
				currentSession: agent.getCurrentSessionId?.() || null
			}, 200, req.requestId);
		} catch (error) {
			logger.error('Error listing sessions:', error);
			errorResponse(
				res,
				ERROR_CODES.INTERNAL_ERROR,
				'Failed to list sessions',
				500,
				error,
				req.requestId
			);
		}
	});

	/**
	 * POST /api/sessions
	 * Create a new session
	 */
	router.post('/', validateCreateSession, async (req: Request, res: Response) => {
		try {
			const { sessionId } = req.body;

			logger.info('Creating new session', {
				requestId: req.requestId,
				sessionId: sessionId || 'auto-generated',
			});

			const session = await agent.createSession(sessionId);

			successResponse(
				res,
				{
					session: {
						id: session.id,
						// Only include serializable session properties
						createdAt: new Date().toISOString(),
					},
					created: true,
					timestamp: new Date().toISOString(),
				},
				201,
				req.requestId
			);
		} catch (error) {
			// Safely extract error message to avoid circular reference issues
			let errorMsg: string;
			try {
				errorMsg = error instanceof Error ? error.message : String(error);
			} catch (stringifyError) {
				errorMsg = 'Unknown error occurred during session creation';
			}

			logger.error('Failed to create session', {
				requestId: req.requestId,
				error: errorMsg,
			});

			// Check if error is due to duplicate session ID
			if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
				errorResponse(
					res,
					ERROR_CODES.BAD_REQUEST,
					`Session creation failed: ${errorMsg}`,
					400,
					undefined,
					req.requestId
				);
			} else {
				errorResponse(
					res,
					ERROR_CODES.INTERNAL_ERROR,
					`Failed to create session: ${errorMsg}`,
					500,
					undefined,
					req.requestId
				);
			}
		}
	});

	/**
	 * GET /api/sessions/current
	 * Get current working session
	 */
	router.get('/current', async (req: Request, res: Response) => {
		try {
			const currentSessionId = agent.getCurrentSessionId();
			const metadata = await agent.getSessionMetadata(currentSessionId);

			if (!metadata) {
				errorResponse(
					res,
					ERROR_CODES.SESSION_NOT_FOUND,
					'Current session not found',
					404,
					undefined,
					req.requestId
				);
				return;
			}

			successResponse(
				res,
				{
					sessionId: currentSessionId,
					metadata,
					isCurrent: true,
				},
				200,
				req.requestId
			);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			logger.error('Failed to get current session', {
				requestId: req.requestId,
				error: errorMsg,
			});

			errorResponse(
				res,
				ERROR_CODES.INTERNAL_ERROR,
				`Failed to get current session: ${errorMsg}`,
				500,
				undefined,
				req.requestId
			);
		}
	});

	/**
	 * GET /api/sessions/:sessionId
	 * Get session details
	 */
	router.get('/:sessionId', validateSessionId, async (req: Request, res: Response) => {
		try {
			const { sessionId } = req.params;

			if (!sessionId) {
				errorResponse(
					res,
					ERROR_CODES.BAD_REQUEST,
					'Session ID is required',
					400,
					undefined,
					req.requestId
				);
				return;
			}

			logger.info('Getting session details', {
				requestId: req.requestId,
				sessionId,
			});

			const session = await agent.getSession(sessionId);
			if (!session) {
				errorResponse(
					res,
					ERROR_CODES.SESSION_NOT_FOUND,
					`Session ${sessionId} not found`,
					404,
					undefined,
					req.requestId
				);
				return;
			}

			const metadata = await agent.getSessionMetadata(sessionId);

			successResponse(
				res,
				{
					sessionId,
					metadata,
					isCurrent: sessionId === agent.getCurrentSessionId(),
				},
				200,
				req.requestId
			);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			logger.error('Failed to get session details', {
				requestId: req.requestId,
				sessionId: req.params.sessionId,
				error: errorMsg,
			});

			errorResponse(
				res,
				ERROR_CODES.INTERNAL_ERROR,
				`Failed to get session details: ${errorMsg}`,
				500,
				undefined,
				req.requestId
			);
		}
	});

	/**
	 * POST /api/sessions/:sessionId/load
	 * Load session as current
	 */
	router.post('/:sessionId/load', validateSessionId, async (req: Request, res: Response) => {
		try {
			const { sessionId } = req.params;

			if (!sessionId) {
				errorResponse(
					res,
					ERROR_CODES.BAD_REQUEST,
					'Session ID is required',
					400,
					undefined,
					req.requestId
				);
				return;
			}

			logger.info('Loading session', {
				requestId: req.requestId,
				sessionId,
			});

			const session = await agent.loadSession(sessionId);

			// CRITICAL FIX: Ensure conversation history is available in the loaded session
			// This is essential for UI mode to display previous messages when switching sessions
			try {
				// Force refresh conversation history after loading
				if (session && typeof session.refreshConversationHistory === 'function') {
					await session.refreshConversationHistory();
					logger.debug(`Session ${sessionId}: Refreshed conversation history after loading`);
				}
				
				// Verify history is available
				if (session && typeof session.getConversationHistory === 'function') {
					const history = await session.getConversationHistory();
					logger.info(`Session ${sessionId}: Loaded with ${history.length} messages in conversation history`);
				}
			} catch (historyError) {
				logger.warn(`Session ${sessionId}: Failed to refresh history after loading:`, historyError);
				// Continue even if history refresh fails
			}

			successResponse(
				res,
				{
					sessionId: session.id,
					loaded: true,
					currentSession: agent.getCurrentSessionId(),
					timestamp: new Date().toISOString(),
				},
				200,
				req.requestId
			);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			logger.error('Failed to load session', {
				requestId: req.requestId,
				sessionId: req.params.sessionId,
				error: errorMsg,
			});

			if (errorMsg.includes('not found')) {
				errorResponse(
					res,
					ERROR_CODES.SESSION_NOT_FOUND,
					`Session ${req.params.sessionId} not found`,
					404,
					undefined,
					req.requestId
				);
			} else {
				errorResponse(
					res,
					ERROR_CODES.INTERNAL_ERROR,
					`Failed to load session: ${errorMsg}`,
					500,
					undefined,
					req.requestId
				);
			}
		}
	});

	/**
	 * GET /api/sessions/:sessionId/history
	 * Get session conversation history
	 */
	router.get('/:sessionId/history', validateSessionId, async (req: Request, res: Response) => {
		try {
			const { sessionId } = req.params;

			if (!sessionId) {
				errorResponse(
					res,
					ERROR_CODES.BAD_REQUEST,
					'Session ID is required',
					400,
					undefined,
					req.requestId
				);
				return;
			}

			logger.info('Getting session history', {
				requestId: req.requestId,
				sessionId,
			});

			let history = [];
			let historySource = 'none';

			// First try to get history from the session manager (active session)
			try {
				const session = await agent.getSession(sessionId);
				if (session) {
					history = await agent.getSessionHistory(sessionId);
					historySource = 'session-manager';
					logger.debug(`Got ${history.length} messages from active session ${sessionId}`);
				}
			} catch (error) {
				logger.debug(`Session ${sessionId} not found in session manager, checking database...`);
			}

			// If no history found in session manager, try to get from database storage
			if (history.length === 0) {
				try {
					const sessionManager = agent.sessionManager;
					let storageManager = sessionManager.getStorageManagerForSession('default');
					
					// If no storage manager from default session, try to get the shared one
					if (!storageManager) {
						try {
							// Access the session manager's storage directly
							const backends = (sessionManager as any).storageManager?.getBackends?.();
							if (backends) {
								storageManager = { getBackends: () => backends };
							}
						} catch (error) {
							logger.debug('Could not access session manager storage:', error);
						}
					}
					
					if (storageManager && storageManager.getBackends) {
						const backends = storageManager.getBackends();
						if (backends && backends.database) {
							// Try to get conversation history from messages key
							const historyKey = `messages:${sessionId}`;
							const historyData = await backends.database.get(historyKey);
							if (historyData && Array.isArray(historyData)) {
								history = historyData;
								historySource = 'database-messages';
								logger.info(`Found ${history.length} messages for session ${sessionId} in database (messages key)`);
							} else {
								// Try to get from persisted session data
								const sessionKey = `session:${sessionId}`;
								const sessionData = await backends.database.get(sessionKey);
								if (sessionData && sessionData.conversationHistory && Array.isArray(sessionData.conversationHistory)) {
									history = sessionData.conversationHistory;
									historySource = 'database-session';
									logger.info(`Found ${history.length} messages for session ${sessionId} in database (session data)`);
								}
							}
						}
					}
				} catch (error) {
					logger.warn(`Failed to get history from database for session ${sessionId}:`, error);
				}
			}
			
			// Log the final result
			logger.info(`Session ${sessionId} history retrieval: ${history.length} messages from ${historySource}`);

			successResponse(
				res,
				{
					sessionId,
					history,
					count: history.length,
					timestamp: new Date().toISOString(),
				},
				200,
				req.requestId
			);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			logger.error('Failed to get session history', {
				requestId: req.requestId,
				sessionId: req.params.sessionId,
				error: errorMsg,
			});

			errorResponse(
				res,
				ERROR_CODES.INTERNAL_ERROR,
				`Failed to get session history: ${errorMsg}`,
				500,
				undefined,
				req.requestId
			);
		}
	});

	/**
	 * DELETE /api/sessions/:sessionId
	 * Delete session
	 */
	router.delete('/:sessionId', validateSessionId, async (req: Request, res: Response) => {
		try {
			const { sessionId } = req.params;

			if (!sessionId) {
				errorResponse(
					res,
					ERROR_CODES.BAD_REQUEST,
					'Session ID is required',
					400,
					undefined,
					req.requestId
				);
				return;
			}

			logger.info('Deleting session', {
				requestId: req.requestId,
				sessionId,
			});

			const success = await agent.removeSession(sessionId);

			if (!success) {
				errorResponse(
					res,
					ERROR_CODES.SESSION_NOT_FOUND,
					`Session ${sessionId} not found`,
					404,
					undefined,
					req.requestId
				);
				return;
			}

			successResponse(
				res,
				{
					sessionId,
					deleted: true,
					timestamp: new Date().toISOString(),
				},
				200,
				req.requestId
			);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			logger.error('Failed to delete session', {
				requestId: req.requestId,
				sessionId: req.params.sessionId,
				error: errorMsg,
			});

			if (errorMsg.includes('Cannot remove the currently active session')) {
				errorResponse(
					res,
					ERROR_CODES.BAD_REQUEST,
					'Cannot delete the currently active session. Switch to another session first.',
					400,
					undefined,
					req.requestId
				);
			} else {
				errorResponse(
					res,
					ERROR_CODES.INTERNAL_ERROR,
					`Failed to delete session: ${errorMsg}`,
					500,
					undefined,
					req.requestId
				);
			}
		}
	});

	return router;
}

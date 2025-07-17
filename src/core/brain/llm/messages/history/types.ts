import { InternalMessage } from '../types.js';

export interface IConversationHistoryProvider {
  /**
   * Retrieve the conversation history for a session.
   * @param sessionId The session identifier
   * @param limit Optional maximum number of messages to retrieve (default: 1000)
   * @returns Promise resolving to an array of InternalMessage objects, ordered chronologically
   */
  getHistory(sessionId: string, limit?: number): Promise<InternalMessage[]>;

  /**
   * Save a message to the conversation history for a session.
   * @param sessionId The session identifier
   * @param message The message to save
   */
  saveMessage(sessionId: string, message: InternalMessage): Promise<void>;

  /**
   * Clear the conversation history for a session.
   * @param sessionId The session identifier
   */
  clearHistory(sessionId: string): Promise<void>;
}

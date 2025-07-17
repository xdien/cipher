## Overview

Implement a sophisticated two-tier event system for cipher. This will enhance observability, enable reactive programming patterns, and provide better integration capabilities while maintaining cipher's existing architectural integrity.

## 📋 Background

the current architecture follows a modular, service-oriented design with strong separation of concerns. The system would benefit from an event-driven architecture that:

- Provides real-time visibility into service operations
- Enables reactive programming patterns for background processing
- Facilitates external integrations and monitoring
- Maintains type safety and follows cipher's existing patterns

## 🏗️ Architecture Design

### Two-Tier Event System

**Service-Level Events (Global)**

- Scoped to entire cipher instance
- Include sessionId context when relevant
- Track service health, lifecycle, and cross-session operations

**Session-Level Events (Scoped)**

- Scoped to individual conversation sessions
- Track user interactions, tool executions, and memory operations
- No sessionId needed (already scoped)

### Event Categories

```typescript
// Service-level events
const SERVICE_EVENT_NAMES = [
	'cipher:serviceStarted',
	'cipher:serviceStopped',
	'cipher:connectionChanged',
	'cipher:toolRegistered',
	'cipher:toolUnregistered',
	'cipher:mcpClientConnected',
	'cipher:mcpClientDisconnected',
	'cipher:memoryOperationStarted',
	'cipher:memoryOperationCompleted',
	'cipher:knowledgeGraphUpdated',
] as const;

// Session-level events
const SESSION_EVENT_NAMES = [
	'session:created',
	'session:activated',
	'session:expired',
	'llm:thinking',
	'llm:responseStarted',
	'llm:responseCompleted',
	'tool:executionStarted',
	'tool:executionCompleted',
	'tool:executionFailed',
	'memory:extractionStarted',
	'memory:extractionCompleted',
	'memory:stored',
	'memory:retrieved',
] as const;
```

### Type-Safe Event Maps

```typescript
interface ServiceEventMap {
	'cipher:serviceStarted': { serviceType: string; timestamp: number };
	'cipher:serviceStopped': { serviceType: string; reason?: string };
	'cipher:toolRegistered': { toolName: string; toolType: 'internal' | 'mcp' };
	'cipher:memoryOperationCompleted': { operation: string; duration: number; success: boolean };
	// ... more events
}

interface SessionEventMap {
	'session:created': { sessionId: string; userId?: string };
	'tool:executionStarted': { toolName: string; args: any };
	'tool:executionCompleted': { toolName: string; result: any; duration: number };
	'memory:stored': { type: string; content: any; vectorId?: string };
	// ... more events
}
```

## 📁 Implementation Plan

### Core Event Infrastructure (High Priority)

**File Structure:**

```
src/core/events/
├── index.ts              # Event definitions, types, and exports
├── event-manager.ts      # Core event management classes
├── service-events.ts     # Service-level event bus
├── session-events.ts     # Session-level event bus
└── __test__/
    ├── event-manager.test.ts
    └── integration.test.ts
```

**Tasks:**

- [ ] Create base `TypedEventEmitter` class with AbortController support
- [ ] Implement `ServiceEventBus` for global events
- [ ] Implement `SessionEventBus` for session-scoped events
- [ ] Add compile-time validation for event names and type maps
- [ ] Create comprehensive unit tests

### Service Integration (Medium Priority)

**Integration Points:**

- [ ] **ServiceInitializer**: Add EventManager to AgentServices
- [ ] **SessionManager**: Emit session lifecycle events (`session:created`, `session:expired`)
- [ ] **UnifiedToolManager**: Emit tool execution events (`tool:executionStarted`, `tool:executionCompleted`)
- [ ] **MCPManager**: Emit connection events (`cipher:mcpClientConnected`, `cipher:mcpClientDisconnected`)
- [ ] **VectorStoreManager**: Emit memory operation events (`memory:stored`, `memory:retrieved`)
- [ ] **InternalToolManager**: Emit internal tool events
- [ ] **LLMService**: Emit thinking and response events

### Enhanced Features (Low Priority)

**Advanced Features:**

- [ ] **Event Persistence**: Store events for debugging/monitoring
- [ ] **Event Forwarding**: Webhook integrations for external systems
- [ ] **Event Filtering**: Performance-optimized event routing
- [ ] **Metrics Collection**: Event-based performance monitoring
- [ ] **Event Replay**: Debugging and testing capabilities

## Key Implementation Details

### 1. AbortController Integration

```typescript
// Automatic cleanup when component unmounts
eventBus.on('tool:executionCompleted', listener, { signal: abortController.signal });
```

### 2. Manager Pattern Integration

```typescript
class SessionManager {
	constructor(private eventBus: ServiceEventBus) {}

	async createSession(sessionId: string): Promise<void> {
		// ... existing logic
		this.eventBus.emit('session:created', { sessionId, timestamp: Date.now() });
	}
}
```

### 3. Background Processing Enhancement

```typescript
// Memory extraction with events
private async extractMemoryWithEvents(sessionId: string, content: string): Promise<void> {
  this.sessionEventBus.emit('memory:extractionStarted', { sessionId });
  try {
    const result = await this.extractMemory(content);
    this.sessionEventBus.emit('memory:extractionCompleted', { sessionId, success: true });
  } catch (error) {
    this.sessionEventBus.emit('memory:extractionCompleted', { sessionId, success: false, error });
  }
}
```

## Benefits

### 1. Enhanced Observability

- Track tool execution performance and success rates
- Monitor memory operation effectiveness
- Debug session lifecycle issues with detailed event logs

### 2. Reactive Programming

- Build features that respond to events (e.g., auto-cleanup on session expiry)
- Implement event-driven background processing
- Create flexible integration patterns

### 3. External Integration

- Webhook notifications for memory updates
- Real-time monitoring dashboards
- Third-party tool integrations and analytics

### 4. Debugging and Monitoring

- Comprehensive event logs for troubleshooting
- Performance metrics collection
- Error tracking and alerting capabilities

## Performance Considerations

- **Non-blocking event emission**: Events don't slow down core operations
- **Memory-efficient storage**: Configurable event retention policies
- **Efficient filtering**: Optimized event routing and subscription management
- **AbortController cleanup**: Automatic memory leak prevention

## Integration with Existing Patterns

The event system will integrate seamlessly with cipher's existing patterns:

- **Manager Pattern**: Each manager gets EventManager injection
- **Factory Pattern**: Event system configured via factory functions
- **Background Processing**: Memory events emitted asynchronously
- **Logger Integration**: Events can trigger structured logging
- **TypeScript Safety**: Compile-time validation of event types

## Testing Strategy

- **Unit Tests**: Test event emission, subscription, and cleanup
- **Integration Tests**: Test event flow across services
- **Performance Tests**: Ensure events don't impact core performance
- **AbortController Tests**: Verify proper cleanup and memory management

## Implementation Checklist

### Core Infrastructure

- [ ] Create `src/core/events/` directory structure
- [ ] Implement `TypedEventEmitter` base class
- [ ] Create `ServiceEventBus` and `SessionEventBus`
- [ ] Add event type definitions and validation
- [ ] Write comprehensive tests
- [ ] Update `service-initializer.ts` to include event system

### Service Integration

- [ ] Integrate with SessionManager
- [ ] Integrate with UnifiedToolManager
- [ ] Integrate with MCPManager
- [ ] Integrate with VectorStoreManager
- [ ] Integrate with InternalToolManager
- [ ] Integrate with LLMService
- [ ] Add event emission to all key operations

### Advanced Features

- [ ] Implement event persistence
- [ ] Add webhook forwarding
- [ ] Create event filtering system
- [ ] Add metrics collection
- [ ] Implement event replay capabilities

# Logger System Documentation

The Logger system in Cipher provides a comprehensive, event-driven logging infrastructure designed for Cipher. It features hierarchical logging, asynchronous event processing, and flexible output destinations.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Components](#core-components)
- [Getting Started](#getting-started)
- [Usage Patterns](#usage-patterns)
- [Configuration](#configuration)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

## Overview

### Key Features

- **Event-Driven Architecture**: Decouples log generation from processing
- **Hierarchical Namespaces**: Organize loggers with dot-notation hierarchies
- **Asynchronous Processing**: Non-blocking event emission and processing
- **Rich Context Support**: Attach structured context to log events
- **Timed Operations**: Built-in support for operation timing
- **Flexible Output**: Pluggable listeners and transports
- **Type Safety**: Full TypeScript support with strict typing

### Event Types

The logger supports five core event types:

- `debug`: Detailed debugging information
- `info`: General informational messages
- `warning`: Warning conditions that should be noted
- `error`: Error conditions and exceptions
- `progress`: Progress updates with percentage tracking

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│     Logger      │───▶│  AsyncEventBus   │───▶│   Listeners     │
│                 │    │                  │    │                 │
│ - namespace     │    │ - event queue    │    │ - console       │
│ - context       │    │ - async process  │    │ - file           │
│ - child loggers │    │ - error handling │    │ - custom        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Transports    │
                       │                 │
                       │ - HTTP          │
                       │ - file           │
                       │ - console       │
                       └─────────────────┘
```

### Component Relationships

1. **Logger**: Primary interface for emitting log events
2. **AsyncEventBus**: Singleton event dispatcher with asynchronous processing
3. **Events**: Structured data objects representing log entries
4. **Listeners**: Process events for display/output (e.g., console formatting)
5. **Transports**: Send events to external destinations (e.g., HTTP endpoints)

## Core Components

### Logger Class

The `Logger` class is the main interface for creating log events:

```typescript
class Logger {
  constructor(namespace: string, sessionId?: string, defaultContext?: EventContext)
  
  // Log methods
  debug(message: string, name?: string, context?: EventContext, data?: Record<string, any>): void
  info(message: string, name?: string, context?: EventContext, data?: Record<string, any>): void
  warning(message: string, name?: string, context?: EventContext, data?: Record<string, any>): void
  error(message: string, name?: string, context?: EventContext, data?: Record<string, any>): void
  progress(message: string, name?: string, percentage?: number, context?: EventContext, data?: Record<string, any>): void
  exception(error: Error | any, message?: string, name?: string, context?: EventContext, data?: Record<string, any>): void
  
  // Hierarchy and timing
  child(childNamespace: string, additionalContext?: EventContext): Logger
  timer(operationName: string): TimedOperation
}
```

### AsyncEventBus

The event bus manages event distribution with these capabilities:

- **Singleton Pattern**: Single instance across the application
- **Asynchronous Processing**: Events are queued and processed asynchronously
- **Error Resilience**: Failed listeners don't affect other listeners
- **Lifecycle Management**: Start/stop functionality for listeners

### Event Structure

Events follow a consistent structure:

```typescript
interface Event {
  type: EventType;              // debug | info | warning | error | progress
  name?: string;                // Optional operation name
  namespace: string;            // Logger hierarchy (e.g., "app.database.query")
  message: string;              // Human-readable message
  timestamp: Date;              // When the event occurred
  data?: Record<string, any>;   // Structured data
  context?: EventContext;       // Contextual information
}
```

### TimedOperation

Helper class for tracking operation duration:

```typescript
class TimedOperation {
  withContext(context: EventContext): TimedOperation
  start(message?: string): TimedOperation
  end(message?: string, data?: Record<string, any>): void
  error(error: Error, message?: string, data?: Record<string, any>): void
}
```

## Getting Started

### Basic Setup

```typescript
import { Logger, LoggingConfig } from '@cipher/logger';

// Configure the logging system
await LoggingConfig.configure({
  enableConsoleListener: true
});

// Create a logger
const logger = new Logger('app');

// Log some messages
logger.info('Application started');
logger.warning('Configuration missing', 'config', undefined, { key: 'database.url' });

// Shutdown when done
await LoggingConfig.shutdown();
```

### Quick Example

```typescript
import { Logger, LoggingConfig } from '@cipher/logger';

async function quickExample() {
  await LoggingConfig.configure();
  
  const logger = new Logger('api.users');
  
  logger.info('Processing user request', 'request-start', 
    { userId: '123', requestId: 'req_456' }, 
    { method: 'POST', path: '/users' }
  );
  
  const timer = logger.timer('database-query').start();
  // ... perform database operation
  timer.end('User created successfully', { userId: '123' });
  
  await LoggingConfig.shutdown();
}
```

## Usage Patterns

### Hierarchical Logging

Create organized logger hierarchies:

```typescript
const appLogger = new Logger('app');
const dbLogger = appLogger.child('database');
const userServiceLogger = appLogger.child('service.user');

// Results in namespaces:
// - app
// - app.database  
// - app.service.user
```

### Contextual Logging

Add persistent context to loggers:

```typescript
const logger = new Logger('api', sessionId, {
  userId: 'user_123',
  version: '1.2.0',
  environment: 'production'
});

// All events will include this context
logger.info('Request processed');  // Includes userId, version, environment
```

### Error Handling

Comprehensive error logging:

```typescript
try {
  await riskyOperation();
} catch (error) {
  // Handles both Error objects and other error types
  logger.exception(error, 'Operation failed', 'risk-op', 
    { operationId: 'op_123' },
    { retryCount: 3, lastSuccess: '2024-01-01T10:00:00Z' }
  );
}
```

### Timed Operations

Track operation performance:

```typescript
const operation = logger.timer('data-processing')
  .withContext({ batchId: 'batch_001' })
  .start('Starting batch processing');

try {
  await processBatch();
  operation.end('Batch processed successfully', { 
    recordsProcessed: 1000,
    errors: 0 
  });
} catch (error) {
  operation.error(error, 'Batch processing failed');
}
```

### Progress Tracking

Monitor long-running operations:

```typescript
logger.progress('Uploading file', 'file-upload', 25, 
  { fileId: 'file_123' }, 
  { uploaded: 250000, total: 1000000 }
);
```

## Configuration

### LoggingConfig Options

```typescript
interface LoggingConfigOptions {
  eventFilter?: EventFilter;           // Filter events by type/namespace
  transport?: EventTransport;          // Custom transport for events
  batchSize?: number;                  // Batch size for processing
  flushInterval?: number;              // Flush interval in milliseconds
  progressDisplay?: boolean;           // Enable progress display
  enableConsoleListener?: boolean;     // Default console output
}
```

### Console Listener Configuration

```typescript
await LoggingConfig.configure({
  enableConsoleListener: true
});

// Or with custom console configuration
const consoleListener = new ConsoleListener({
  colorize: true,
  format: 'pretty',        // 'pretty' | 'json' | 'text'
  includeTimestamp: true
});

LoggingConfig.addListener('console', consoleListener);
```

### Managed Configuration

Automatically handle setup and cleanup:

```typescript
await LoggingConfig.managed(
  { enableConsoleListener: true },
  async () => {
    const logger = new Logger('app');
    logger.info('This will be automatically cleaned up');
    // Your application logic here
  }
);
```

## Advanced Features

### Custom Listeners

Create custom event processors:

```typescript
import { EventListener, Event } from '@cipher/logger';

class CustomListener implements EventListener {
  async handleEvent(event: Event): Promise<void> {
    // Custom processing logic
    if (event.type === 'error') {
      await this.sendAlert(event);
    }
  }
  
  private async sendAlert(event: Event): Promise<void> {
    // Send to monitoring service
  }
}

// Register the listener
LoggingConfig.addListener('alerts', new CustomListener());
```

### Event Filtering

Filter events by type, namespace, or custom criteria:

```typescript
const filter: EventFilter = {
  types: new Set(['error', 'warning']),
  namespaces: new Set(['app.database', 'app.auth']),
  minLevel: 'warning'
};

const listener = new CustomListener(filter);
```

### Custom Transports

Send events to external services:

```typescript
import { EventTransport, Event } from '@cipher/logger';

class HttpTransport implements EventTransport {
  constructor(private config: HttpTransportConfig) {}
  
  async sendEvent(event: Event): Promise<void> {
    await fetch(this.config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
  }
}

await LoggingConfig.configure({
  transport: new HttpTransport({ url: 'https://logs.example.com/events' })
});
```

### Global Context

Set context available to all loggers:

```typescript
import { setGlobalLogContext, getGlobalLogContext } from '@cipher/logger';

// Set global context
setGlobalLogContext({
  applicationVersion: '1.0.0',
  environment: 'production',
  deploymentId: 'deploy_123'
});

// All loggers will inherit this context
const logger = new Logger('service');
logger.info('Service started'); // Includes global context
```

## Best Practices

### 1. Namespace Organization

Use consistent, hierarchical namespaces:

```typescript
// Good
const apiLogger = new Logger('api');
const userApiLogger = apiLogger.child('users');
const authLogger = apiLogger.child('auth');

// Avoid
const randomLogger = new Logger('xyz123');
```

### 2. Context Usage

Add meaningful context to log events:

```typescript
// Good
logger.info('User login successful', 'auth.login', 
  { userId: user.id, loginMethod: 'password' },
  { sessionDuration: '24h', lastLogin: user.lastLogin }
);

// Avoid generic messages
logger.info('Login ok');
```

### 3. Error Handling

Always use `exception()` for errors:

```typescript
// Good
try {
  await operation();
} catch (error) {
  logger.exception(error, 'Operation failed', 'op-name', context, data);
}

// Avoid
logger.error(error.toString()); // Loses stack trace and structure
```

### 4. Performance Considerations

Use appropriate log levels and avoid expensive operations:

```typescript
// Good - lazy evaluation
logger.debug('Complex data', 'debug', undefined, () => ({
  expensiveData: computeExpensiveData()
}));

// Avoid - always computed
logger.debug('Complex data', 'debug', undefined, {
  expensiveData: computeExpensiveData() // Always computed even if debug disabled
});
```

### 5. Timed Operations

Use timed operations for performance monitoring:

```typescript
// Good
const timer = logger.timer('database-query').start();
try {
  const result = await db.query();
  timer.end('Query successful', { resultCount: result.length });
} catch (error) {
  timer.error(error, 'Query failed');
}
```

### 6. Lifecycle Management

Always manage logging lifecycle:

```typescript
// Good
await LoggingConfig.configure();
try {
  // Application logic
} finally {
  await LoggingConfig.shutdown();
}

// Or use managed configuration
await LoggingConfig.managed(config, async () => {
  // Application logic - automatic cleanup
});
```

## API Reference

### Logger Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `debug(message, name?, context?, data?)` | Log debug information | message, optional name, context, data |
| `info(message, name?, context?, data?)` | Log informational message | message, optional name, context, data |
| `warning(message, name?, context?, data?)` | Log warning condition | message, optional name, context, data |
| `error(message, name?, context?, data?)` | Log error condition | message, optional name, context, data |
| `progress(message, name?, percentage?, context?, data?)` | Log progress update | message, name, percentage (0-100), context, data |
| `exception(error, message?, name?, context?, data?)` | Log exception with full error details | Error object, optional message, name, context, data |
| `child(namespace, context?)` | Create child logger | child namespace, additional context |
| `timer(operationName)` | Create timed operation | operation name |

### LoggingConfig Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `configure(options?)` | Configure logging system | LoggingConfigOptions |
| `shutdown()` | Shutdown logging system | none |
| `managed(options, callback)` | Managed configuration with auto-cleanup | options, async callback |
| `addListener(name, listener)` | Add event listener | name, EventListener |
| `removeListener(name)` | Remove event listener | name |

### TimedOperation Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `withContext(context)` | Add context to operation | EventContext |
| `start(message?)` | Start timer and log start event | optional message |
| `end(message?, data?)` | End timer and log completion | optional message, data |
| `error(error, message?, data?)` | End timer with error | Error, optional message, data |

### Event Types

```typescript
type EventType = 'debug' | 'info' | 'warning' | 'error' | 'progress';

interface EventContext {
  sessionId?: string;
  workflowId?: string;
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

interface Event {
  type: EventType;
  name?: string;
  namespace: string;
  message: string;
  timestamp: Date;
  data?: Record<string, any>;
  context?: EventContext;
}
```

---

This logger system provides a robust foundation for application logging with the flexibility to adapt to various output requirements and performance needs. The event-driven architecture ensures that logging doesn't block application flow while providing rich debugging and monitoring capabilities. 
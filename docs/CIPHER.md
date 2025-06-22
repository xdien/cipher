# CIPHER Documentation

This document provides a comprehensive overview of the system within the Cipher project.

## Table of Contents

- [Context System](#context-system)
  - [Overview](#context-overview)
  - [Core Components](#context-core-components)
  - [Usage Patterns](#context-usage-patterns)
  - [Global Context Management](#global-context-management)
- [Logger System](#logger-system)
  - [Overview](#logger-overview)
  - [Architecture](#logger-architecture)
  - [Event Types](#logger-event-types)
  - [Timed Operations](#timed-operations)
  - [Best Practices](#logger-best-practices)
- [Integration Between Systems](#integration-between-systems)

## Context System <a name="context-system"></a>

### Overview <a name="context-overview"></a>

The Context system serves as the central state container for the application. It provides a type-safe, schema-validated mechanism for storing and retrieving application state and dependencies. The system is built around the core `Context` class, which implements the `IContext` interface.

Key features:
- Centralized state management
- Type-safe access with TypeScript generics
- Schema validation using Zod
- Hierarchical context with parent-child relationships
- Global singleton context access

### Core Components <a name="context-core-components"></a>

#### IContext Interface

The `IContext` interface (`types.ts`) defines the structure of the context object with the following key component groups:

1. **Core Application Components**
   - `config`: Application configuration settings
   - `executor`: Execution environment
   - `sessionId`: Unique session identifier
   - `app`: Main application instance

2. **Registries**
   - `serverRegistry`: For server components
   - `taskRegistry`: For activity management
   - `signalRegistry`: For signal handling
   - `decoratorRegistry`: For decorators
   - `workflowRegistry`: For workflows

3. **Runtime Components**
   - `humanInputHandler`: For handling user input
   - `signalNotification`: For signal notifications
   - `upstreamSession`: For upstream connections
   - `modelSelector`: For model selection

4. **Logger Integration**
   - `logger`: Instance of the Logger component

#### Context Class

The `Context` class (`context.ts`) provides the concrete implementation of the `IContext` interface with the following capabilities:

- Schema validation of input data
- Type-safe access to stored components
- Creation of child contexts with inheritance
- JSON serialization for storage or transmission
- Property presence checking

```typescript
// Example: Creating a new context
const context = new Context({
  sessionId: 'session-123',
  logger: new Logger('app')
});

// Example: Accessing a component
const logger = context.get('logger');

// Example: Creating a child context
const childContext = context.createChildContext({
  // Override or add properties
});
```

### Usage Patterns <a name="context-usage-patterns"></a>

#### Local Context

Use a local context when you need isolated state for a specific component:

```typescript
// Create a local context for a specific component
const componentContext = new Context({
  logger: new Logger('component'),
  // Other component-specific state
});
```

#### Child Contexts

Create child contexts to inherit parent state while adding or overriding specific properties:

```typescript
// Create a child context that inherits from parent
const childContext = parentContext.createChildContext({
  // Properties to override or add
  sessionId: 'child-session'
});
```

#### Context Merging

Merge two contexts to combine their state:

```typescript
// Merge additional state into current context
const updatedContext = context.merge({
  // Additional state to merge in
  config: updatedConfig
});
```

### Global Context Management <a name="global-context-management"></a>

The global context system (`global-context.ts`) provides singleton access to a shared context instance throughout the application.

Two access patterns are supported:

1. **Functional approach**
   ```typescript
   // Set the global context
   setGlobalContext(myContext);
   
   // Get the global context
   const context = getCurrentContext();
   
   // Check if global context exists
   const hasContext = hasGlobalContext();
   
   // Clear the global context
   clearGlobalContext();
   ```

2. **Class-based approach**
   ```typescript
   // Get the singleton instance
   const manager = GlobalContextManager.getInstance();
   
   // Set the global context
   manager.setGlobalContext(myContext);
   
   // Get the global context
   const context = manager.getCurrentContext();
   ```

## Logger System <a name="logger-system"></a>

### Overview <a name="logger-overview"></a>

The Logger system provides an event-driven, hierarchical logging infrastructure. It's built around an asynchronous event bus that decouples log event generation from processing, allowing for flexible handling of log events.

Key features:
- Hierarchical logging with namespaces
- Event-driven architecture
- Asynchronous event processing
- Rich context support
- Timed operation tracking
- Robust error handling

### Architecture <a name="logger-architecture"></a>

The Logger system consists of these key components:

1. **Logger Class**
   - Primary interface for emitting log events
   - Hierarchical namespaces with parent-child relationships
   - Context inheritance and merging

2. **AsyncEventBus**
   - Singleton event dispatcher
   - Asynchronous event processing
   - Error resilience

3. **Event Types**
   - Structured event definitions
   - Rich context and metadata

4. **Listeners & Transports**
   - Configurable log destinations
   - Pluggable processing pipeline

#### Logger Class

The `Logger` class (`logger.ts`) is the primary interface for emitting log events:

```typescript
// Create a root logger
const logger = new Logger('app', sessionId);

// Log messages at different levels
logger.debug('Debug message');
logger.info('Info message');
logger.warning('Warning message');
logger.error('Error message');

// Log with additional context and data
logger.info('Operation completed', 'operation-name', 
  { userId: '123' },  // Context
  { results: [...] }  // Data
);

// Log exceptions (both Error objects and other error types)
try {
  // ...
} catch (error) {
  logger.exception(error, 'Failed to process data');
}
```

#### Hierarchical Logging

Loggers can be organized hierarchically with the `child()` method:

```typescript
// Create child loggers with extended namespace
const databaseLogger = logger.child('database');
const userServiceLogger = logger.child('user.service', { serviceVersion: '1.2.3' });

// Results in namespaces:
// - app.database
// - app.user.service
```

### Event Types <a name="logger-event-types"></a>

The Logger supports several event types:

- `debug`: Detailed debugging information
- `info`: General information messages
- `warning`: Warning conditions
- `error`: Error conditions
- `progress`: Progress updates with percentage

### Timed Operations <a name="timed-operations"></a>

The Logger provides built-in support for tracking timed operations:

```typescript
// Create and start a timed operation
const operation = logger.timer('database-query')
  .withContext({ queryId: '123' })
  .start('Starting database query');

try {
  // Perform the operation
  const results = await database.query(...);
  
  // Log successful completion with duration
  operation.end('Query completed successfully', { resultCount: results.length });
} catch (err) {
  // Log failure with duration and error details
  operation.error(err, 'Query failed');
}
```

### Best Practices <a name="logger-best-practices"></a>

1. **Hierarchical Namespaces**
   - Use dot notation to establish clear hierarchy
   - Keep namespaces consistent across related components

2. **Context Usage**
   - Add relevant context to log events
   - Use consistent keys for common context values

3. **Error Handling**
   - Use `exception()` for all error conditions
   - Provide meaningful error messages

4. **Performance Considerations**
   - Use appropriate log levels
   - Consider the volume of log events in high-traffic components

## Integration Between Systems <a name="integration-between-systems"></a>

The Context and Logger systems are designed to work together seamlessly:

1. **Logger in Context**
   - The `IContext` includes a `logger` property
   - Context can be initialized with a logger instance
   - Child contexts can inherit or override the logger

2. **Context in Logs**
   - Logger can include context information in log events
   - Child loggers can add context specific to their domain

Example integration:

```typescript
// Create a logger
const logger = new Logger('app', sessionId);

// Create a context with the logger
const context = new Context({
  sessionId,
  logger
});

// Use logger from context
const contextLogger = context.get('logger');
contextLogger?.info('Using logger from context');

// Create a child context with custom logger
const childContext = context.createChildContext({
  logger: logger.child('child')
});

// Use the child logger
const childLogger = childContext.get('logger');
childLogger?.info('Using logger from child context');
```

This integration pattern ensures consistent logging throughout the application while maintaining separation of concerns between state management and logging functionality.

/**
 * MCP Connection - Server Connection Management
 *
 * Exports all connection management components including ServerConnection,
 * TransportFactory, HealthMonitor, and lifecycle management for persistent MCP connections.
 */

// Server connection
export {
	ServerConnection,
	type ConnectionState,
	type HealthCheckConfig,
	type ServerConnectionConfig,
} from './server-connection.js';

// Transport factory
export {
	TransportFactory,
	type TransportInstance,
	type TransportCreationConfig,
} from './transport-factory.js';

// Health monitor
export {
	HealthMonitor,
	type HealthCheckResult,
	type HealthMetrics,
	type HealthMonitorConfig,
	type HealthMonitorable,
	type HealthEventType,
	type HealthEvent,
	type HealthEventListener,
} from './health-monitor.js';

// Lifecycle manager
export {
	ConnectionLifecycleManager,
	type ConnectionLifecycleState,
	type ConnectionLifecycleInfo,
	type LifecycleManagerConfig,
	type LifecycleEventType,
	type LifecycleEvent,
	type LifecycleEventListener,
	type LifecycleStatistics,
} from './lifecycle-manager.js';

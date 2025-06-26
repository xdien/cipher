import { z } from 'zod';
export const StdioServerConfigSchema = z
	.object({
		type: z.literal('stdio'),
		command: z
			.string()
			.describe("Command to launch the MCP server (e.g., 'node', 'python', 'uvx')"),
		args: z
			.array(z.string())
			.describe("Arguments to pass to the command (e.g., ['server.js', '--port=3000'])"),
		env: z
			.record(z.string())
			.default({})
			.describe(
				'Environment variables to set for the server process (e.g., API keys, configuration)'
			),
		timeout: z
			.number()
			.int()
			.positive()
			.default(30000)
			.describe('Maximum time in milliseconds to wait for server startup (30 seconds default)'),
		connectionMode: z
			.enum(['strict', 'lenient'])
			.default('lenient')
			.describe(
				'How to handle connection failures: "strict" fails immediately, "lenient" continues with warnings'
			),
	})
	.strict();
export type StdioServerConfig = z.input<typeof StdioServerConfigSchema>;
export const SseServerConfigSchema = z
	.object({
		type: z.literal('sse'),
		url: z
			.string()
			.url()
			.describe(
				'Complete URL of the Server-Sent Events endpoint (e.g., "https://api.example.com/sse")'
			),
		headers: z
			.record(z.string())
			.default({})
			.describe(
				'HTTP headers for authentication or configuration (e.g., {"Authorization": "Bearer token"})'
			),
		timeout: z
			.number()
			.int()
			.positive()
			.default(30000)
			.describe('Maximum time in milliseconds to establish SSE connection (30 seconds default)'),
		connectionMode: z
			.enum(['strict', 'lenient'])
			.default('lenient')
			.describe(
				'How to handle connection failures: "strict" fails immediately, "lenient" continues with warnings'
			),
	})
	.strict();
// Input type for user-facing API (pre-parsing)
export type SseServerConfig = z.input<typeof SseServerConfigSchema>;

export const HttpServerConfigSchema = z
	.object({
		type: z.literal('http'),
		url: z
			.string()
			.url()
			.describe('Base URL of the HTTP MCP server (e.g., "https://api.example.com")'),
		headers: z
			.record(z.string())
			.default({})
			.describe(
				'HTTP headers sent with every request (e.g., {"Authorization": "Bearer token", "User-Agent": "MyApp"})'
			),
		timeout: z
			.number()
			.int()
			.positive()
			.default(30000)
			.describe('Maximum time in milliseconds to wait for HTTP responses (30 seconds default)'),
		connectionMode: z
			.enum(['strict', 'lenient'])
			.default('lenient')
			.describe(
				'How to handle connection failures: "strict" fails immediately, "lenient" continues with warnings'
			),
	})
	.strict();
// Input type for user-facing API (pre-parsing)
export type HttpServerConfig = z.input<typeof HttpServerConfigSchema>;

export const McpServerConfigSchema = z
	.discriminatedUnion(
		'type',
		[StdioServerConfigSchema, SseServerConfigSchema, HttpServerConfigSchema],
		{
			errorMap: (issue, ctx) => {
				if (issue.code === z.ZodIssueCode.invalid_union_discriminator) {
					return {
						message: `Invalid server type. Expected 'stdio', 'sse', or 'http'.`,
					};
				}
				return { message: ctx.defaultError };
			},
		}
	)
	.describe(
		'MCP server configuration - choose stdio for local processes, sse for real-time streams, or http for REST APIs'
	);
export const ServerConfigsSchema = z
	.record(McpServerConfigSchema)
	.describe('Named collection of MCP server configurations (server name -> configuration)');

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

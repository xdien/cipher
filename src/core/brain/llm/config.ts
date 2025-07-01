import { z } from 'zod';
export const LLMConfigSchema = z
	.object({
		provider: z
			.string()
			.nonempty()
			.describe("The LLM provider (e.g., 'openai', 'anthropic', 'openrouter')"),
		model: z.string().nonempty().describe('The specific model name for the selected provider'),
		apiKey: z
			.string()
			.min(1)
			.describe(
				'API key for the LLM provider (can also be set via environment variables using $VAR syntax)'
			),
		maxIterations: z
			.number()
			.int()
			.positive()
			.optional()
			.default(50)
			.describe(
				'Maximum number of iterations for agentic loops or chained LLM calls, defaults to 50'
			),
		baseURL: z
			.string()
			.url()
			.optional()
			.describe(
				'Base URL for the LLM provider (e.g., https://api.openai.com/v1, https://openrouter.ai/api/v1). \nSupported for OpenAI and OpenRouter providers.'
			),
	})
	.strict()
	.superRefine((data, ctx) => {
		const providerLower = data.provider?.toLowerCase();
		const supportedProvidersList = ['openai', 'anthropic', 'openrouter'];
		if (!supportedProvidersList.includes(providerLower)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['provider'],
				message: `Provider '${data.provider}' is not supported. Supported: ${supportedProvidersList.join(', ')}`,
			});
		}
	});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

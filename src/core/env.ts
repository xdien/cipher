import { z } from 'zod';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const EnvSchema = z.object({
	// API Keys
	OPENAI_API_KEY: z.string().optional(),
	ANTHROPIC_API_KEY: z.string().optional(),

	// API Configuration
	OPENAI_BASE_URL: z.string().optional(),

	// Logger Configuration
	CIPHER_LOG_LEVEL: z.string().optional(),
	REDACT_SECRETS: z.string().optional(),
});

// Create a dynamic env object that always reads from process.env
export const env: z.infer<typeof EnvSchema> = new Proxy({} as z.infer<typeof EnvSchema>, {
	get(target, prop: string) {
		return process.env[prop];
	}
});

export const validateEnv = () => {
	// Create actual object from process.env for validation
	const envToValidate = {
		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
		ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
		OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
		CIPHER_LOG_LEVEL: process.env.CIPHER_LOG_LEVEL,
		REDACT_SECRETS: process.env.REDACT_SECRETS,
	};
	
	const result = EnvSchema.safeParse(envToValidate);
	if (!result.success) {
		// Note: logger might not be available during early initialization
		console.error('Invalid environment variables', result.error);
	}
	return result.success;
};

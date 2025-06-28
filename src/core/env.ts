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

export const env: z.infer<typeof EnvSchema> = {
	// API Keys
	OPENAI_API_KEY: process.env.OPENAI_API_KEY,
	ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
	
	// API Configuration
	OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
	
	// Logger Configuration
	CIPHER_LOG_LEVEL: process.env.CIPHER_LOG_LEVEL,
	REDACT_SECRETS: process.env.REDACT_SECRETS,
};

export const validateEnv = () => {
	const result = EnvSchema.safeParse(env);
	if (!result.success) {
		// Note: logger might not be available during early initialization
		console.error('Invalid environment variables', result.error);
	}
	return result.success;
}; 
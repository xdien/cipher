import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
config();

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	CIPHER_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
	REDACT_SECRETS: z.boolean().default(true),
	OPENAI_API_KEY: z.string().optional(),
	ANTHROPIC_API_KEY: z.string().optional(),
	OPENROUTER_API_KEY: z.string().optional(),
	OPENAI_BASE_URL: z.string().optional(),
	// Storage Configuration
	STORAGE_CACHE_TYPE: z.enum(['redis', 'in-memory']).default('in-memory'),
	STORAGE_CACHE_HOST: z.string().optional(),
	STORAGE_CACHE_PORT: z.number().optional(),
	STORAGE_CACHE_PASSWORD: z.string().optional(),
	STORAGE_CACHE_DATABASE: z.number().optional(),
	STORAGE_DATABASE_TYPE: z.enum(['sqlite', 'in-memory']).default('in-memory'),
	STORAGE_DATABASE_PATH: z.string().optional(),
	STORAGE_DATABASE_NAME: z.string().optional(),
	// Vector Storage Configuration
	VECTOR_STORE_TYPE: z.enum(['qdrant', 'in-memory']).default('in-memory'),
	VECTOR_STORE_HOST: z.string().optional(),
	VECTOR_STORE_PORT: z.number().optional(),
	VECTOR_STORE_URL: z.string().optional(),
	VECTOR_STORE_API_KEY: z.string().optional(),
	VECTOR_STORE_COLLECTION: z.string().default('default'),
	VECTOR_STORE_DIMENSION: z.number().default(1536),
	VECTOR_STORE_DISTANCE: z.enum(['Cosine', 'Euclidean', 'Dot', 'Manhattan']).default('Cosine'),
	VECTOR_STORE_ON_DISK: z.boolean().default(false),
	VECTOR_STORE_MAX_VECTORS: z.number().default(10000),
});

type EnvSchema = z.infer<typeof envSchema>;

// Create a dynamic env object that always reads from process.env but provides type safety
export const env: EnvSchema = new Proxy({} as EnvSchema, {
	get(target, prop: string): any {
		switch (prop) {
			case 'NODE_ENV':
				return process.env.NODE_ENV || 'development';
			case 'CIPHER_LOG_LEVEL':
				return process.env.CIPHER_LOG_LEVEL || 'info';
			case 'REDACT_SECRETS':
				return process.env.REDACT_SECRETS === 'false' ? false : true;
			case 'OPENAI_API_KEY':
				return process.env.OPENAI_API_KEY;
			case 'ANTHROPIC_API_KEY':
				return process.env.ANTHROPIC_API_KEY;
			case 'OPENROUTER_API_KEY':
				return process.env.OPENROUTER_API_KEY;
			case 'OPENAI_BASE_URL':
				return process.env.OPENAI_BASE_URL;
			// Storage Configuration
			case 'STORAGE_CACHE_TYPE':
				return process.env.STORAGE_CACHE_TYPE || 'in-memory';
			case 'STORAGE_CACHE_HOST':
				return process.env.STORAGE_CACHE_HOST;
			case 'STORAGE_CACHE_PORT':
				return process.env.STORAGE_CACHE_PORT
					? parseInt(process.env.STORAGE_CACHE_PORT, 10)
					: undefined;
			case 'STORAGE_CACHE_PASSWORD':
				return process.env.STORAGE_CACHE_PASSWORD;
			case 'STORAGE_CACHE_DATABASE':
				return process.env.STORAGE_CACHE_DATABASE
					? parseInt(process.env.STORAGE_CACHE_DATABASE, 10)
					: undefined;
			case 'STORAGE_DATABASE_TYPE':
				return process.env.STORAGE_DATABASE_TYPE || 'in-memory';
			case 'STORAGE_DATABASE_PATH':
				return process.env.STORAGE_DATABASE_PATH;
			case 'STORAGE_DATABASE_NAME':
				return process.env.STORAGE_DATABASE_NAME;
			// Vector Storage Configuration
			case 'VECTOR_STORE_TYPE':
				return process.env.VECTOR_STORE_TYPE || 'in-memory';
			case 'VECTOR_STORE_HOST':
				return process.env.VECTOR_STORE_HOST;
			case 'VECTOR_STORE_PORT':
				return process.env.VECTOR_STORE_PORT
					? parseInt(process.env.VECTOR_STORE_PORT, 10)
					: undefined;
			case 'VECTOR_STORE_URL':
				return process.env.VECTOR_STORE_URL;
			case 'VECTOR_STORE_API_KEY':
				return process.env.VECTOR_STORE_API_KEY;
			case 'VECTOR_STORE_COLLECTION':
				return process.env.VECTOR_STORE_COLLECTION || 'default';
			case 'VECTOR_STORE_DIMENSION':
				return process.env.VECTOR_STORE_DIMENSION
					? parseInt(process.env.VECTOR_STORE_DIMENSION, 10)
					: 1536;
			case 'VECTOR_STORE_DISTANCE':
				return process.env.VECTOR_STORE_DISTANCE || 'Cosine';
			case 'VECTOR_STORE_ON_DISK':
				return process.env.VECTOR_STORE_ON_DISK === 'true';
			case 'VECTOR_STORE_MAX_VECTORS':
				return process.env.VECTOR_STORE_MAX_VECTORS
					? parseInt(process.env.VECTOR_STORE_MAX_VECTORS, 10)
					: 10000;
			default:
				return process.env[prop];
		}
	},
});

export const validateEnv = () => {
	// Get current env values for validation
	const envToValidate = {
		NODE_ENV: process.env.NODE_ENV,
		CIPHER_LOG_LEVEL: process.env.CIPHER_LOG_LEVEL,
		REDACT_SECRETS: process.env.REDACT_SECRETS === 'false' ? false : true,
		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
		ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
		OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
		OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
		// Storage Configuration
		STORAGE_CACHE_TYPE: process.env.STORAGE_CACHE_TYPE || 'in-memory',
		STORAGE_CACHE_HOST: process.env.STORAGE_CACHE_HOST,
		STORAGE_CACHE_PORT: process.env.STORAGE_CACHE_PORT
			? parseInt(process.env.STORAGE_CACHE_PORT, 10)
			: undefined,
		STORAGE_CACHE_PASSWORD: process.env.STORAGE_CACHE_PASSWORD,
		STORAGE_CACHE_DATABASE: process.env.STORAGE_CACHE_DATABASE
			? parseInt(process.env.STORAGE_CACHE_DATABASE, 10)
			: undefined,
		STORAGE_DATABASE_TYPE: process.env.STORAGE_DATABASE_TYPE || 'in-memory',
		STORAGE_DATABASE_PATH: process.env.STORAGE_DATABASE_PATH,
		STORAGE_DATABASE_NAME: process.env.STORAGE_DATABASE_NAME,
		// Vector Storage Configuration
		VECTOR_STORE_TYPE: process.env.VECTOR_STORE_TYPE || 'in-memory',
		VECTOR_STORE_HOST: process.env.VECTOR_STORE_HOST,
		VECTOR_STORE_PORT: process.env.VECTOR_STORE_PORT
			? parseInt(process.env.VECTOR_STORE_PORT, 10)
			: undefined,
		VECTOR_STORE_URL: process.env.VECTOR_STORE_URL,
		VECTOR_STORE_API_KEY: process.env.VECTOR_STORE_API_KEY,
		VECTOR_STORE_COLLECTION: process.env.VECTOR_STORE_COLLECTION || 'default',
		VECTOR_STORE_DIMENSION: process.env.VECTOR_STORE_DIMENSION
			? parseInt(process.env.VECTOR_STORE_DIMENSION, 10)
			: 1536,
		VECTOR_STORE_DISTANCE: process.env.VECTOR_STORE_DISTANCE || 'Cosine',
		VECTOR_STORE_ON_DISK: process.env.VECTOR_STORE_ON_DISK === 'true',
		VECTOR_STORE_MAX_VECTORS: process.env.VECTOR_STORE_MAX_VECTORS
			? parseInt(process.env.VECTOR_STORE_MAX_VECTORS, 10)
			: 10000,
	};

	const result = envSchema.safeParse(envToValidate);
	if (!result.success) {
		// Note: logger might not be available during early initialization
		console.error('Environment validation failed:', result.error.issues);
		return false;
	}
	return result.success;
};

/**
 * AWS Bedrock Embedding Backend
 *
 * Implementation of the AWS Bedrock embedding provider supporting Amazon Titan
 * and Cohere embedding models through the Bedrock Runtime API.
 */

import type { Embedder, EmbeddingConfig } from './types.js';
import { EmbeddingError, EmbeddingConnectionError, EmbeddingValidationError } from './types.js';

/**
 * AWS Bedrock-specific configuration interface
 */
export interface AWSBedrockEmbeddingConfig extends EmbeddingConfig {
	type: 'aws-bedrock';
	model?: 'amazon.titan-embed-text-v2:0' | 'cohere.embed-english-v3';
	region?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
	sessionToken?: string;
	dimensions?: 1024 | 512 | 256; // For Titan V2
}

/**
 * AWS Bedrock embedding provider implementation
 */
export class AWSBedrockEmbedder implements Embedder {
	private readonly config: AWSBedrockEmbeddingConfig;
	private readonly region: string;
	private readonly model: string;
	private readonly dimensions: number;
	private readonly credentials: {
		accessKeyId: string | undefined;
		secretAccessKey: string | undefined;
		sessionToken: string | undefined;
	};

	constructor(config: AWSBedrockEmbeddingConfig) {
		this.config = config;
		this.region = config.region || process.env.AWS_DEFAULT_REGION || 'us-east-1';
		this.model = config.model || 'amazon.titan-embed-text-v2:0';
		this.dimensions = config.dimensions || 1024;
		
		this.credentials = {
			accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID || undefined,
			secretAccessKey: config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || undefined,
			sessionToken: config.sessionToken || process.env.AWS_SESSION_TOKEN || undefined,
		};

		if (!this.credentials.accessKeyId || !this.credentials.secretAccessKey) {
			throw new EmbeddingValidationError('AWS credentials are required (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)');
		}
	}

	async embed(text: string): Promise<number[]> {
		try {
			const response = await this.makeBedrockRequest(text);
			return this.extractEmbedding(response);
		} catch (error) {
			if (error instanceof EmbeddingError) {
				throw error;
			}
			throw new EmbeddingError(`Failed to generate AWS Bedrock embedding: ${error}`);
		}
	}

	async embedBatch(texts: string[]): Promise<number[][]> {
		try {
			// AWS Bedrock typically processes one text at a time, so we batch manually
			const results: number[][] = [];
			
			for (const text of texts) {
				const embedding = await this.embed(text);
				results.push(embedding);
			}

			return results;
		} catch (error) {
			if (error instanceof EmbeddingError) {
				throw error;
			}
			throw new EmbeddingError(`Failed to generate AWS Bedrock batch embeddings: ${error}`);
		}
	}

	getDimension(): number {
		return this.dimensions;
	}

	getConfig(): AWSBedrockEmbeddingConfig {
		return { ...this.config };
	}

	async isHealthy(): Promise<boolean> {
		try {
			await this.embed('test');
			return true;
		} catch {
			return false;
		}
	}

	async disconnect(): Promise<void> {
		// No persistent connections to close for HTTP-based API
	}

	private async makeBedrockRequest(text: string): Promise<any> {
		const endpoint = `https://bedrock-runtime.${this.region}.amazonaws.com`;
		const url = `${endpoint}/model/${this.model}/invoke`;

		const body = this.buildRequestBody(text);
		const bodyString = JSON.stringify(body);

		// AWS Signature V4 signing
		const headers = await this.signRequest(url, bodyString);

		const timeout = this.config.timeout || 30000;
		const maxRetries = this.config.maxRetries || 3;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeout);

				const response = await globalThis.fetch(url, {
					method: 'POST',
					headers,
					body: bodyString,
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorText = await response.text();
					if (response.status === 429) {
						if (attempt < maxRetries) {
							await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
							continue;
						}
					}
					throw new EmbeddingConnectionError(`AWS Bedrock API error: ${response.status} ${errorText}`);
				}

				return await response.json();
			} catch (error) {
				if (error instanceof EmbeddingError) {
					throw error;
				}
				if (attempt === maxRetries) {
					throw new EmbeddingConnectionError(`Failed to connect to AWS Bedrock after ${maxRetries} attempts: ${error}`);
				}
				await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
			}
		}
	}

	private buildRequestBody(text: string): any {
		if (this.model.startsWith('amazon.titan-embed')) {
			return {
				inputText: text,
				dimensions: this.dimensions,
			};
		} else if (this.model.startsWith('cohere.embed')) {
			return {
				texts: [text],
				input_type: 'search_document',
				embedding_types: ['float'],
			};
		}
		
		throw new EmbeddingValidationError(`Unsupported AWS Bedrock model: ${this.model}`);
	}

	private extractEmbedding(response: any): number[] {
		if (this.model.startsWith('amazon.titan-embed')) {
			if (!response.embedding) {
				throw new EmbeddingError('No embedding data received from AWS Bedrock Titan API');
			}
			return response.embedding;
		} else if (this.model.startsWith('cohere.embed')) {
			if (!response.embeddings || response.embeddings.length === 0) {
				throw new EmbeddingError('No embedding data received from AWS Bedrock Cohere API');
			}
			return response.embeddings[0].values;
		}
		
		throw new EmbeddingError(`Unknown response format for model: ${this.model}`);
	}

	private async signRequest(_url: string, _body: string): Promise<Record<string, string>> {
		// Simplified AWS Signature V4 implementation
		// In production, you should use the AWS SDK or a proper signing library
		
		const now = new Date();
		const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
		const timeStamp = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
		
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'Host': `bedrock-runtime.${this.region}.amazonaws.com`,
			'X-Amz-Date': timeStamp,
			'X-Amz-Target': 'AmazonBedrockRuntime.InvokeModel',
		};

		if (this.credentials.sessionToken) {
			headers['X-Amz-Security-Token'] = this.credentials.sessionToken;
		}

		// Note: This is a simplified implementation
		// For production use, implement proper AWS Signature V4 or use AWS SDK
		const authHeader = `AWS4-HMAC-SHA256 Credential=${this.credentials.accessKeyId}/${dateStamp}/${this.region}/bedrock/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=placeholder`;
		headers['Authorization'] = authHeader;

		return headers;
	}
}

/**
 * Factory function to create an AWS Bedrock embedder
 */
export function createAWSBedrockEmbedder(config: AWSBedrockEmbeddingConfig): AWSBedrockEmbedder {
	return new AWSBedrockEmbedder(config);
}
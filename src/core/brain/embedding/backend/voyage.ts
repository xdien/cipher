/**
 * Voyage Embedding Backend
 *
 * Implementation of the Voyage AI embedding provider for the Cipher embedding system.
 * Provides support for Voyage's embedding models including voyage-3-large.
 */

import type { Embedder, EmbeddingConfig } from './types.js';
import { EmbeddingError, EmbeddingConnectionError, EmbeddingValidationError } from './types.js';

/**
 * Voyage-specific configuration interface
 */
export interface VoyageEmbeddingConfig extends EmbeddingConfig {
	type: 'voyage';
	model?: 'voyage-3-large' | 'voyage-3' | 'voyage-2';
	baseUrl?: string;
}

/**
 * Voyage embedding provider implementation
 */
export class VoyageEmbedder implements Embedder {
	private readonly config: VoyageEmbeddingConfig;
	private readonly apiKey: string;
	private readonly baseUrl: string;
	private readonly model: string;

	constructor(config: VoyageEmbeddingConfig) {
		this.config = config;
		this.apiKey = config.apiKey || process.env.VOYAGE_API_KEY || '';
		this.baseUrl = config.baseUrl || 'https://api.voyageai.com/v1';
		this.model = config.model || 'voyage-3-large';

		if (!this.apiKey) {
			throw new EmbeddingValidationError('Voyage API key is required');
		}
	}

	async embed(text: string): Promise<number[]> {
		try {
			const response = await this.makeRequest({
				input: [text],
				model: this.model,
			});

			if (!response.data || response.data.length === 0) {
				throw new EmbeddingError('No embedding data received from Voyage API');
			}

			return response.data[0].embedding;
		} catch (error) {
			if (error instanceof EmbeddingError) {
				throw error;
			}
			throw new EmbeddingError(`Failed to generate Voyage embedding: ${error}`);
		}
	}

	async embedBatch(texts: string[]): Promise<number[][]> {
		try {
			const response = await this.makeRequest({
				input: texts,
				model: this.model,
			});

			if (!response.data || response.data.length !== texts.length) {
				throw new EmbeddingError('Unexpected response format from Voyage API');
			}

			return response.data.map((item: any) => item.embedding);
		} catch (error) {
			if (error instanceof EmbeddingError) {
				throw error;
			}
			throw new EmbeddingError(`Failed to generate Voyage batch embeddings: ${error}`);
		}
	}

	getDimension(): number {
		// Voyage-3-large has 1024 dimensions, voyage-3 has 1024, voyage-2 has 1024
		return 1024;
	}

	getConfig(): VoyageEmbeddingConfig {
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

	private async makeRequest(body: any): Promise<any> {
		const timeout = this.config.timeout || 30000;
		const maxRetries = this.config.maxRetries || 3;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeout);

				const response = await globalThis.fetch(`${this.baseUrl}/embeddings`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify(body),
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
					throw new EmbeddingConnectionError(`Voyage API error: ${response.status} ${errorText}`);
				}

				return await response.json();
			} catch (error) {
				if (error instanceof EmbeddingError) {
					throw error;
				}
				if (attempt === maxRetries) {
					throw new EmbeddingConnectionError(`Failed to connect to Voyage API after ${maxRetries} attempts: ${error}`);
				}
				await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
			}
		}
	}
}

/**
 * Factory function to create a Voyage embedder
 */
export function createVoyageEmbedder(config: VoyageEmbeddingConfig): VoyageEmbedder {
	return new VoyageEmbedder(config);
}
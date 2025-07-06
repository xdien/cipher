// Requires: npm install @zilliz/milvus2-sdk-node
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';
import type { VectorStore } from './vector-store.js';
import type { SearchFilters, VectorStoreResult, MilvusBackendConfig } from './types.js';
import {
	VectorStoreError,
	VectorStoreConnectionError,
	VectorDimensionError,
	CollectionNotFoundError,
} from './types.js';
import { Logger, createLogger } from '../../logger/index.js';
import { LOG_PREFIXES, DEFAULTS, ERROR_MESSAGES } from '../constants.js';

// Read index and distance config from environment variables (with fallback)
const MILVUS_INDEX_TYPE = process.env.MILVUS_INDEX_TYPE || 'IVF_FLAT';
const VECTOR_STORE_DISTANCE = process.env.VECTOR_STORE_DISTANCE || 'Cosine';
const VECTOR_STORE_CONFIG_EFCONSTRUCTION = process.env.VECTOR_STORE_CONFIG_EFCONSTRUCTION || 10;
const VECTOR_STORE_CONFIG_M = process.env.VECTOR_STORE_CONFIG_M || 4;
/**
 * MilvusBackend Class
 *
 * Implements the VectorStore interface for Milvus vector database.
 *
 * Note: Only address (url/host/port) is used for MilvusClient connection.
 * If authentication is needed, extend config and update here.
 */
export class MilvusBackend implements VectorStore {
	private client: MilvusClient;
	private readonly config: MilvusBackendConfig;
	private readonly collectionName: string;
	private readonly dimension: number;
	private readonly logger: Logger;
	private connected = false;

	// Milvus collection and index configuration
	private readonly MILVUS_COLLECTION_CONFIG = {
		schema: [
			{
				name: 'id',
				description: 'Primary key',
				data_type: DataType.VarChar,
				is_primary_key: true,
				max_length: 128,
			},
			{
				name: 'vector',
				description: 'Vector field',
				data_type: DataType.FloatVector,
			},
			{
				name: 'payload',
				description: 'Payload',
				data_type: DataType.JSON,
			},
		],
		index: {
			field_name: 'vector',
			index_type: MILVUS_INDEX_TYPE,
			metric_type: VECTOR_STORE_DISTANCE,
			params: { efConstruction: VECTOR_STORE_CONFIG_EFCONSTRUCTION, M: VECTOR_STORE_CONFIG_M },
		},
	};

	constructor(config: MilvusBackendConfig) {
		this.config = config;
		this.collectionName = config.collectionName;
		this.dimension = config.dimension;
		this.logger = createLogger({
			level: process.env.LOG_LEVEL || 'info',
		});
		this.client = new MilvusClient({
			address: config.url || `http://${config.host || 'localhost'}:${config.port || 19530}`,
			// username, password, token: not supported in QdrantBackendConfig by default
		});
		this.logger.info(`${LOG_PREFIXES.MILVUS} Milvus Initialized`, {
			collection: this.collectionName,
			dimension: this.dimension,
			host: config.host || config.url || 'local',
		});
	}

	private validateDimension(vector: number[], operation: string): void {
		if (vector.length !== this.dimension) {
			throw new VectorDimensionError(
				`${ERROR_MESSAGES.INVALID_DIMENSION}: expected ${this.dimension}, got ${vector.length}`,
				this.dimension,
				vector.length
			);
		}
	}

	async connect(): Promise<void> {
		if (this.connected) {
			this.logger.debug(`Milvus already connected`);
			return;
		}
		this.logger.info(`Connecting to Milvus`);
		try {
			const collections = await this.client.showCollections();
			const exists = collections.data.some((c: any) => c.name === this.collectionName);
			if (!exists) {
				this.logger.info(`Creating collection ${this.collectionName}`);
				// Clone schema and set dimension dynamically
				const schema = this.MILVUS_COLLECTION_CONFIG.schema.map(field =>
					field.name === 'vector' ? { ...field, dim: this.dimension } : { ...field }
				);
				await this.client.createCollection({
					collection_name: this.collectionName,
					fields: schema,
				});
				await this.client.createIndex({
					collection_name: this.collectionName,
					...this.MILVUS_COLLECTION_CONFIG.index,
				});
			}
			await this.client.loadCollection({ collection_name: this.collectionName });
			this.connected = true;
			this.logger.info(`Milvus connected`);
		} catch (error) {
			this.logger.error(`Milvus connection failed`, { error });
			throw new VectorStoreConnectionError(ERROR_MESSAGES.CONNECTION_FAILED, 'milvus', error as Error);
		}
	}

	async insert(vectors: number[][], ids: string[], payloads: Record<string, any>[]): Promise<void> {
		if (!this.connected) return Promise.reject(new VectorStoreError(ERROR_MESSAGES.NOT_CONNECTED, 'insert'));
		if (vectors.length !== ids.length || vectors.length !== payloads.length) {
			return Promise.reject(new VectorStoreError('Vectors, IDs, and payloads must have the same length', 'insert'));
		}
		for (const vector of vectors) this.validateDimension(vector, 'insert');
		const data = vectors.map((vector, idx) => ({
			id: ids[idx],
			vector,
			payload: payloads[idx],
		}));
		try {
			await this.client.insert({
				collection_name: this.collectionName,
				data,
			});
			this.logger.info(`Inserted ${vectors.length} vectors`);
		} catch (error) {
			this.logger.error(`Insert failed`, { error });
			throw new VectorStoreError('Failed to insert vectors', 'insert', error as Error);
		}
	}

	async search(query: number[], limit: number = 10, filters?: SearchFilters): Promise<VectorStoreResult[]> {
		if (!this.connected) throw new VectorStoreError(ERROR_MESSAGES.NOT_CONNECTED, 'search');
		this.validateDimension(query, 'search');
		try {
			const expr = filtersToExpr(filters);
			const res = await this.client.search({
				collection_name: this.collectionName,
				data: [query],
				anns_field: 'vector',
				params: { nprobe: 10 },
				limit,
				output_fields: ['id', 'payload'],
				filter: expr,
			});
			return res.results.map((hit: any) => ({
				id: hit.id,
				score: hit.score,
				payload: hit.payload,
			}));
		} catch (error) {
			this.logger.error(`Search failed`, { error });
			throw new VectorStoreError(ERROR_MESSAGES.SEARCH_FAILED, 'search', error as Error);
		}
	}

	async get(vectorId: string): Promise<VectorStoreResult | null> {
		if (!this.connected) return Promise.reject(new VectorStoreError(ERROR_MESSAGES.NOT_CONNECTED, 'get'));
		try {
			const res = await this.client.query({
				collection_name: this.collectionName,
				filter: `id == "${vectorId}"`,
				output_fields: ['id', 'vector', 'payload'],
			});
			if (!res.data.length) return null;
			const doc = res.data[0];
			return {
				id: doc.id,
				vector: doc.vector,
				payload: doc.payload,
				score: 1.0,
			};
		} catch (error) {
			this.logger.error(`Get failed`, { error });
			throw new VectorStoreError('Failed to retrieve vector', 'get', error as Error);
		}
	}

	async update(vectorId: string, vector: number[], payload: Record<string, any>): Promise<void> {
		if (!this.connected) return Promise.reject(new VectorStoreError(ERROR_MESSAGES.NOT_CONNECTED, 'update'));
		this.validateDimension(vector, 'update');
		try {
			await this.client.upsert({
				collection_name: this.collectionName,
				data: [{ id: vectorId, vector, payload }],
			});
			this.logger.info(`Updated vector ${vectorId}`);
		} catch (error) {
			this.logger.error(`Update failed`, { error });
			throw new VectorStoreError('Failed to update vector', 'update', error as Error);
		}
	}

	async delete(vectorId: string): Promise<void> {
		if (!this.connected) return Promise.reject(new VectorStoreError(ERROR_MESSAGES.NOT_CONNECTED, 'delete'));
		try {
			await this.client.deleteEntities({
				collection_name: this.collectionName,
				expr: `id == "${vectorId}"`,
			});
			this.logger.info(`Deleted vector ${vectorId}`);
		} catch (error) {
			this.logger.error(`Delete failed`, { error });
			throw new VectorStoreError('Failed to delete vector', 'delete', error as Error);
		}
	}

	async deleteCollection(): Promise<void> {
		if (!this.connected) throw new VectorStoreError(ERROR_MESSAGES.NOT_CONNECTED, 'deleteCollection');
		try {
			await this.client.dropCollection({ collection_name: this.collectionName });
			this.logger.info(`Deleted collection ${this.collectionName}`);
		} catch (error) {
			this.logger.error(`Delete collection failed`, { error });
			throw new VectorStoreError('Failed to delete collection', 'deleteCollection', error as Error);
		}
	}

	async list(filters?: SearchFilters, limit: number = 10000): Promise<[VectorStoreResult[], number]> {
		if (!this.connected) throw new VectorStoreError(ERROR_MESSAGES.NOT_CONNECTED, 'list');
		try {
			const expr = filtersToExpr(filters);
			const res = await this.client.query({
				collection_name: this.collectionName,
				output_fields: ['id', 'vector', 'payload'],
				filter: expr,
				limit,
			});
			const results = res.data.map((doc: any) => ({
				id: doc.id,
				vector: doc.vector,
				payload: doc.payload,
				score: 1.0,
			}));
			return [results, results.length];
		} catch (error) {
			this.logger.error(`List failed`, { error });
			throw new VectorStoreError('Failed to list vectors', 'list', error as Error);
		}
	}

	async disconnect(): Promise<void> {
		this.connected = false;
		this.logger.info(`Milvus disconnected`);
	}

	isConnected(): boolean {
		return this.connected;
	}

	getBackendType(): string {
		return 'milvus';
	}

	getDimension(): number {
		return this.dimension;
	}

	getCollectionName(): string {
		return this.collectionName;
	}

	async listCollections(): Promise<string[]> {
		if (!this.connected) return Promise.reject(new VectorStoreError(ERROR_MESSAGES.NOT_CONNECTED, 'listCollections'));
		const collections = await this.client.showCollections();
		return collections.data.map((c: any) => c.name);
	}
}

function filtersToExpr(filters?: SearchFilters): string | undefined {
	if (!filters) return undefined;
	// Support equality, 'in', and comparison operators (gte, lte, gt, lt)
	return Object.entries(filters)
		.map(([key, value]) => {
			if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
				return `${key} == "${value}"`;
			}
			if (value && typeof value === 'object') {
				// Support 'in' operator
				if ('any' in value && Array.isArray(value.any)) {
					const arr = value.any.map(v => `"${v}"`).join(', ');
					return `${key} in [${arr}]`;
				}
				// Support comparison operators
				const ops: Record<string, string> = { gte: '>=', lte: '<=', gt: '>', lt: '<' };
				return Object.entries(ops)
					.filter(([op]) => op in value)
					.map(([op, symbol]) => `${key} ${symbol} ${value[op]}`)
					.join(' && ');
			}
			return '';
		})
		.filter(Boolean)
		.join(' && ');
}

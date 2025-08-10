# Vector Stores

Vector stores are databases optimized for storing and searching high-dimensional vectors (embeddings). Cipher supports multiple vector database providers for flexible deployment options.

## Supported Vector Stores

Cipher supports three vector database types:
- **Qdrant** - High-performance vector search engine
- **Milvus** - Open-source vector database with cloud options
- **In-Memory** - Built-in solution for development/testing

## Qdrant Configuration

[Qdrant](https://qdrant.tech/) is a high-performance vector search engine with excellent performance and features.

### Qdrant Cloud (Managed)

The easiest way to get started with Qdrant:

```bash
# .env configuration
VECTOR_STORE_TYPE=qdrant
VECTOR_STORE_URL=https://your-cluster.qdrant.io
VECTOR_STORE_API_KEY=your-qdrant-api-key
```

**Setup Steps:**
1. Create account at [Qdrant Cloud](https://cloud.qdrant.io/)
2. Create a new cluster
3. Copy your cluster URL and API key
4. Add to your `.env` file

### Qdrant Local (Docker)

Run Qdrant locally using Docker (official setup):

```bash
# Start Qdrant with Docker (official command)
docker run -p 6333:6333 qdrant/qdrant
```

```bash
# .env configuration
VECTOR_STORE_TYPE=qdrant
VECTOR_STORE_HOST=localhost
VECTOR_STORE_PORT=6333
VECTOR_STORE_URL=http://localhost:6333
```

**Important:** Before deploying to production, review the [Qdrant installation](https://qdrant.tech/documentation/guides/installation/) and [security](https://qdrant.tech/documentation/guides/security/) guides.

### Qdrant Docker Compose

Add to your `docker-compose.yml`:

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      - QDRANT__SERVICE__HTTP_PORT=6333

volumes:
  qdrant_data:
```

## Milvus Configuration

[Milvus](https://milvus.io/) is an open-source vector database with excellent scalability.

### Zilliz Cloud (Managed Milvus)

[Zilliz Cloud](https://zilliz.com/) provides managed Milvus hosting:

```bash
# .env configuration
VECTOR_STORE_TYPE=milvus
VECTOR_STORE_URL=your-milvus-cluster-endpoint
VECTOR_STORE_USERNAME=your-zilliz-username
VECTOR_STORE_PASSWORD=your-zilliz-password
```

**Setup Steps:**
1. Create account at [Zilliz Cloud](https://cloud.zilliz.com/)
2. Create a new cluster
3. Get your cluster endpoint and credentials
4. Add to your `.env` file

### Milvus Local (Docker)

Run Milvus locally using the official installation script:

```bash
# Download the official installation script
curl -sfL https://raw.githubusercontent.com/milvus-io/milvus/master/scripts/standalone_embed.sh -o standalone_embed.sh

# Start the Docker container
bash standalone_embed.sh start
```

```bash
# .env configuration
VECTOR_STORE_TYPE=milvus
VECTOR_STORE_HOST=localhost
VECTOR_STORE_PORT=19530
```

**Services Started:**
- **Milvus server**: Port 19530
- **Embedded etcd**: Port 2379  
- **Web UI**: http://127.0.0.1:9091/webui/
- **Data volume**: `volumes/milvus`

**Service Management:**
```bash
# Restart Milvus
bash standalone_embed.sh restart

# Stop Milvus
bash standalone_embed.sh stop

# Upgrade Milvus
bash standalone_embed.sh upgrade

# Delete Milvus (removes all data)
bash standalone_embed.sh delete
```

## In-Memory Vector Store

For development and testing, Cipher includes a built-in in-memory vector store:

```bash
# .env configuration
VECTOR_STORE_TYPE=in-memory
# No additional configuration needed
```

**Features:**
- No external dependencies
- Fast for small datasets
- Data is lost when application restarts
- Perfect for development and testing

## Vector Store Settings

### Collection Configuration

```bash
# Collection name for knowledge memory
VECTOR_STORE_COLLECTION=knowledge_memory

# Vector dimensions (must match your embedding model)
VECTOR_STORE_DIMENSION=1536

# Distance metric for similarity calculations
VECTOR_STORE_DISTANCE=Cosine  # Options: Cosine, Euclidean, Dot
```

### Reflection Memory (Optional)

Cipher supports a separate collection for reflection memory:

```bash
# Enable reflection memory with separate collection
REFLECTION_VECTOR_STORE_COLLECTION=reflection_memory

# Disable reflection memory entirely
DISABLE_REFLECTION_MEMORY=true  # default: true
```

### Performance Settings

```bash
# Maximum number of vectors to store (in-memory only)
VECTOR_STORE_MAX_VECTORS=10000

# Search parameters
VECTOR_STORE_SEARCH_LIMIT=50
VECTOR_STORE_SIMILARITY_THRESHOLD=0.7
```

## Workspace Memory Collections

When using [workspace memory](./workspace-memory.md), you can configure separate vector store settings:

```bash
# Enable workspace memory
USE_WORKSPACE_MEMORY=true

# Workspace-specific collection
WORKSPACE_VECTOR_STORE_COLLECTION=workspace_memory

# Use separate vector store for workspace (optional)
WORKSPACE_VECTOR_STORE_TYPE=qdrant
WORKSPACE_VECTOR_STORE_HOST=localhost
WORKSPACE_VECTOR_STORE_PORT=6333
WORKSPACE_VECTOR_STORE_URL=http://localhost:6333
WORKSPACE_VECTOR_STORE_API_KEY=your-qdrant-api-key

# Workspace search settings
WORKSPACE_SEARCH_THRESHOLD=0.4
WORKSPACE_VECTOR_STORE_DIMENSION=1536
WORKSPACE_VECTOR_STORE_MAX_VECTORS=10000
```

## Complete Configuration Examples

### Production Setup (Qdrant Cloud)

```bash
# .env
VECTOR_STORE_TYPE=qdrant
VECTOR_STORE_URL=https://your-cluster.qdrant.io
VECTOR_STORE_API_KEY=your-qdrant-api-key
VECTOR_STORE_COLLECTION=knowledge_memory
VECTOR_STORE_DIMENSION=1536
VECTOR_STORE_DISTANCE=Cosine

# Reflection memory
REFLECTION_VECTOR_STORE_COLLECTION=reflection_memory
DISABLE_REFLECTION_MEMORY=false  # default: true

# Workspace memory
USE_WORKSPACE_MEMORY=true
WORKSPACE_VECTOR_STORE_COLLECTION=workspace_memory
```

### Development Setup (In-Memory)

```bash
# .env
VECTOR_STORE_TYPE=in-memory
VECTOR_STORE_COLLECTION=knowledge_memory
VECTOR_STORE_DIMENSION=1536
VECTOR_STORE_MAX_VECTORS=5000

# Disable reflection memory for simplicity
DISABLE_REFLECTION_MEMORY=true  # default: true

# Enable workspace memory for testing
USE_WORKSPACE_MEMORY=true
WORKSPACE_VECTOR_STORE_COLLECTION=workspace_memory
```

### Hybrid Setup (Multiple Databases)

```bash
# .env - Main memory in Qdrant, workspace in Milvus
VECTOR_STORE_TYPE=qdrant
VECTOR_STORE_URL=https://your-qdrant-cluster.qdrant.io
VECTOR_STORE_API_KEY=your-qdrant-api-key

# Workspace memory in separate Milvus instance
USE_WORKSPACE_MEMORY=true
WORKSPACE_VECTOR_STORE_TYPE=milvus
WORKSPACE_VECTOR_STORE_URL=your-milvus-endpoint
WORKSPACE_VECTOR_STORE_USERNAME=your-milvus-username
WORKSPACE_VECTOR_STORE_PASSWORD=your-milvus-password
```

## Dimension Compatibility

Ensure your vector store dimensions match your embedding model:

| Embedding Provider | Default Dimensions | Configuration |
| ------------------ | ------------------ | ------------- |
| OpenAI text-embedding-3-small | 1536 | `VECTOR_STORE_DIMENSION=1536` |
| OpenAI text-embedding-3-large | 3072 | `VECTOR_STORE_DIMENSION=3072` |
| Gemini embedding-001 | 768 | `VECTOR_STORE_DIMENSION=768` |
| Qwen text-embedding-v3 | 1024/768/512 | Set matching dimension |
| Voyage models | 1024/2048/etc | Set matching dimension |

## Troubleshooting

### Dimension Mismatch

**Dimension Error**
```
Error: Vector dimension mismatch
```
**Solution:**
- Check your embedding model dimensions
- Update `VECTOR_STORE_DIMENSION` to match
- Recreate collections if dimensions changed

### Performance Issues

**Slow Search Performance**
- Increase `VECTOR_STORE_SEARCH_LIMIT` for more results
- Adjust `VECTOR_STORE_SIMILARITY_THRESHOLD` (lower = more results)
- Consider upgrading to cloud-hosted solutions for better performance

**Memory Usage (In-Memory Store)**
- Reduce `VECTOR_STORE_MAX_VECTORS` if memory is limited
- Switch to external vector store for larger datasets

## Related Documentation

- [Configuration](./configuration.md) - Main configuration guide
- [Embedding Configuration](./embedding-configuration.md) - Embedding setup
- [Workspace Memory](./workspace-memory.md) - Team-aware memory system
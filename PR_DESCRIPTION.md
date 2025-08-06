# Fix MCP Endpoint Routing for Remote Client Access + Docker Build Fix for Apple Silicon

## 🔍 Root Cause

### Issue #174: MCP Client Connection Problems
MCP clients (Cursor, Windsurf, Claude Code) could not connect to Cipher's MCP endpoints when deployed remotely.

**Problems identified:**
1. **Hardcoded /api prefix:** All API routes were mounted under /api, making MCP endpoints available at /api/mcp instead of the expected /mcp
2. **Misleading logs:** Startup messages showed "MCP endpoints available at /mcp/sse and /mcp" but actual paths were /api/mcp/sse and /api/mcp
3. **Client expectations:** MCP clients expect standard endpoints at /mcp and /mcp/sse, not prefixed versions

### Issue #175: Docker Build Failure on Apple Silicon
Docker builds failed on Apple Silicon Macs with native module compatibility errors:
```
Error: Cannot find module '../lightningcss.linux-arm64-musl.node'
```

**Root Cause:** Next.js with Tailwind CSS/LightningCSS native modules compiled for macOS ARM64 don't work in Linux ARM64 Alpine containers.

## ✅ Solution

### Core Changes for MCP Routing

Implemented configurable API prefix to enable flexible endpoint routing:

- **Added apiPrefix configuration** to ApiServerConfig interface
- **Environment variable support:** `CIPHER_API_PREFIX=""` disables prefix
- **CLI flag support:** `--api-prefix ""` command line option
- **Dynamic route building:** All routes now use configurable prefix
- **Fixed startup logs:** Show actual endpoint URLs with correct prefix

### Docker Build Fix for Apple Silicon

**Solution:** Build the UI on the host (Mac) and copy the built files into the Docker image.

**Key Changes:**
- **Modified Dockerfile** to remove `RUN pnpm run build` step
- **Added host build process** with `BUILD_STANDALONE=true` for Next.js standalone output
- **Copy prebuilt UI** from `dist/src/app/ui/.next/standalone` into container
- **Copy static files and public assets** for complete UI deployment

## Usage Examples

### MCP Endpoint Configuration

```bash
# Default behavior (backward compatible)
cipher --mode api
# Routes: /api/mcp, /api/message, /api/sessions

# Standard MCP endpoints (for remote clients)
CIPHER_API_PREFIX="" cipher --mode api
# Routes: /mcp, /message, /sessions

# Custom prefix
cipher --mode api --api-prefix "/v1"
# Routes: /v1/mcp, /v1/message, /v1/sessions
```

### Docker Setup for Remote MCP Access

#### Step 1: Clone and Configure
```bash
git clone <repository-url>
cd cipher
cp .env.example .env
```

#### Step 2: Set API Keys in .env
```bash
# Required: Add at least one API key
OPENAI_API_KEY=sk-your-actual-openai-key-here
# OR
ANTHROPIC_API_KEY=sk-ant-your-actual-anthropic-key-here

# Recommended settings for Docker
NODE_ENV=production
CIPHER_LOG_LEVEL=info
VECTOR_STORE_TYPE=in-memory
STORAGE_DATABASE_TYPE=in-memory
STORAGE_CACHE_TYPE=in-memory
```

#### Step 3: Build UI on Host (Apple Silicon Fix)
```bash
# Build UI with standalone output
cd src/app/ui
BUILD_STANDALONE=true pnpm run build
cd ../../../../
pnpm run copy-ui-dist
```

#### Step 4: Build and Start Docker
```bash
# Build and start Cipher
docker-compose up --build -d

# Verify it's running
docker-compose logs -f cipher-api
```

**Expected success logs:**
```
✅ [API Server] Using API prefix: '(none)'
✅ [API Server] MCP SSE endpoints available at /mcp/sse and /mcp
✅ API Server started on 0.0.0.0:3000
```

#### Step 5: Test Endpoints
```bash
# Health check
curl http://localhost:3000/health

# MCP server listing (should work without /api prefix)
curl http://localhost:3000/mcp/servers/
```

#### Step 6: Connect MCP Clients

**Cursor Configuration:**
```json
{
  "mcpServers": {
    "cipher": {
      "transport": {
        "type": "sse",
        "url": "http://localhost:3000/mcp/sse",
        "postUrl": "http://localhost:3000/mcp"
      }
    }
  }
}
```

**Other clients:** Use `http://localhost:3000/mcp` as the MCP endpoint URL.

## 🎯 Result

### MCP Routing Fix
- ✅ **Backward Compatible:** Default /api prefix behavior preserved
- ✅ **Standard MCP Endpoints:** `CIPHER_API_PREFIX=""` enables /mcp paths
- ✅ **Remote Deployment Ready:** Works with Cursor, Windsurf, Claude Code
- ✅ **Accurate Logging:** Startup messages show correct endpoint URLs
- ✅ **Docker Optimized:** Simple single-service deployment

### Docker Build Fix
- ✅ **Apple Silicon Compatible:** Builds successfully on M1/M2 Macs
- ✅ **Native Module Issue Resolved:** No more LightningCSS ARM64 compatibility errors
- ✅ **Host-Built UI:** Prebuilt Next.js standalone output copied into container
- ✅ **Production Ready:** Optimized Docker image with minimal footprint

## 📁 Files Changed

### MCP Routing Fix
- `src/app/api/server.ts`: API prefix configuration and route building
- `src/app/index.ts`: CLI and environment variable support
- `docker-compose.yml`: Updated for MCP-ready deployment

### Docker Build Fix
- `Dockerfile`: Modified to use host-built UI instead of building in container
- `scripts/copy-ui-dist.ts`: Enhanced to handle Next.js standalone output
- `src/app/ui/next.config.ts`: Configured for standalone output

## 🧪 Tested

### MCP Routing
- ✅ Default behavior with /api prefix
- ✅ Disabled prefix with `CIPHER_API_PREFIX=""`
- ✅ CLI flag `--api-prefix ""`
- ✅ Docker deployment with MCP endpoints
- ✅ Cursor MCP client connection
- ✅ Startup log accuracy

### Docker Build Fix
- ✅ Apple Silicon Mac build process
- ✅ Next.js standalone output generation
- ✅ UI copy script execution
- ✅ Docker image build with prebuilt UI
- ✅ Container startup and health checks
- ✅ MCP endpoint accessibility in containerized environment

## 🔧 Technical Details

### Docker Build Process for Apple Silicon
1. **Host Build:** `BUILD_STANDALONE=true pnpm run build` in `src/app/ui`
2. **Copy Output:** `pnpm run copy-ui-dist` copies to `dist/src/app/ui/.next/standalone`
3. **Docker Copy:** Dockerfile copies prebuilt files into container
4. **Result:** Native module compatibility issues eliminated

### MCP Endpoint Configuration
- **Environment Variable:** `CIPHER_API_PREFIX=""` disables API prefix
- **CLI Flag:** `--api-prefix ""` provides runtime configuration
- **Route Building:** Dynamic prefix application for all API routes
- **Logging:** Accurate endpoint URL display during startup

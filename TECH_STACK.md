# Tech Stack

This document outlines the technology stack used in the Cipher project.

## Core Technologies

- **Language:** [TypeScript](https://www.typescriptlang.org/) - The primary language used for development, providing static typing over JavaScript.
- **Runtime Environment:** [Node.js](https://nodejs.org/) - Used for running the server-side application.
- **Package Manager:** [pnpm](https://pnpm.io/) - Fast, disk space-efficient package manager.

## Backend

- **Web Framework:** [Express.js](https://expressjs.com/) - A minimal and flexible Node.js web application framework used for building the API.
- **API Security:**
    - [Helmet](https://helmetjs.github.io/) - Helps secure Express apps by setting various HTTP headers.
    - [CORS](https://expressjs.com/en/resources/middleware/cors.html) - Middleware for enabling Cross-Origin Resource Sharing.
    - [express-rate-limit](https://www.npmjs.com/package/express-rate-limit) - Basic rate-limiting middleware for Express.
- **API Validation:** [express-validator](https://express-validator.github.io/docs/) - Middleware for validating incoming request data.

## Command Line Interface (CLI)

- **Framework:** [Commander.js](https://github.com/tj/commander.js) - A lightweight Node.js framework for building command-line interfaces.
- **Output Formatting:**
    - [chalk](https://github.com/chalk/chalk) - For styling terminal string output.
    - [boxen](https://github.com/sindresorhus/boxen) - For creating boxes in the terminal.

## Artificial Intelligence & Machine Learning

- **LLM SDKs:**
    - [@ai-sdk/openai](https://www.npmjs.com/package/@ai-sdk/openai) - AI SDK for OpenAI.
    - [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) - SDK for Anthropic's AI models.
    - [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai) - Google's Generative AI SDK.
    - [@azure/openai](https://www.npmjs.com/package/@azure/openai) - Azure OpenAI SDK.
    - [@aws-sdk/client-bedrock-runtime](https://www.npmjs.com/package/@aws-sdk/client-bedrock-runtime) - AWS Bedrock Runtime SDK.
    - [openai](https://www.npmjs.com/package/openai) - OpenAI Node.js library.
- **Model Context Protocol:** [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - SDK for the Model Context Protocol.
- **Tokenizer:** [tiktoken](https://github.com/openai/tiktoken) - A fast BPE tokenizer for use with OpenAI models.

## Data Storage

- **Vector Databases:**
    - [@qdrant/js-client-rest](https://www.npmjs.com/package/@qdrant/js-client-rest) - Qdrant client for JavaScript.
    - [@zilliz/milvus2-sdk-node](https://www.npmjs.com/package/@zilliz/milvus2-sdk-node) - Milvus Node.js SDK.
- **Relational & Graph Databases:**
    - [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) - A simple, fast, and reliable SQLite3 client.
    - [pg](https://www.npmjs.com/package/pg) - PostgreSQL client for Node.js.
    - [neo4j-driver](https://www.npmjs.com/package/neo4j-driver) - Neo4j driver for Node.js.
- **In-Memory Storage:** [ioredis](https://www.npmjs.com/package/ioredis) - A robust, high-performance Redis client.

## Development Tools

- **Build Tool:** [tsup](https://tsup.egoist.dev/) - A simple and fast bundler for TypeScript libraries.
- **Testing:** [Vitest](https://vitest.dev/) - A blazing fast unit-test framework powered by Vite.
- **Linting:** [ESLint](https://eslint.org/) - For identifying and reporting on patterns found in ECMAScript/JavaScript code.
- **Code Formatting:** [Prettier](https://prettier.io/) - An opinionated code formatter.
- **Git Hooks:** [Husky](https://typicode.github.io/husky/) - For managing Git hooks.
- **Schema Validation:** [Zod](https://zod.dev/) - A TypeScript-first schema declaration and validation library.

## Deployment

- **Containerization:** [Docker](https://www.docker.com/) - For creating, deploying, and running applications in containers.

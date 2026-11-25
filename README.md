# Folio Ledger — Library Management System

Production-grade full-stack Library Management System built with React, TypeScript, Tailwind CSS, Motion, Recharts, Node.js, Express, Socket.IO, and MongoDB/Mongoose.

## Architecture Overview

- **Frontend (`/src`)**: React 19, TypeScript, Vite, Tailwind CSS v4 (Light & Dark themes), Motion (`motion/react`), Recharts, React Router, React Hook Form + Zod, jsPDF + AutoTable.
- **Backend (`/backend/src` & `/server.ts`)**: Express.js REST API, Socket.IO real-time notifications, Mongoose ODM (16 models), Zod validation, Helmet, strict CORS allowlist, rate limiting, Multer magic-byte upload verification, JWT access tokens (in-memory) + HttpOnly refresh token rotation.
- **Database**: Supports any external MongoDB instance (`MONGODB_URI` in `.env`) and automatically boots an embedded `MongoMemoryReplSet` with WiredTiger transactions when `MONGODB_URI` is omitted in local/preview environments.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (copy `.env.example` to `.env` if connecting to an external MongoDB instance):
   ```bash
   cp .env.example .env
   ```
3. Start development server on port 3000:
   ```bash
   npm run dev
   ```
4. Build for production & start:
   ```bash
   npm run build
   npm start
   ```
5. Run automated unit & security integration tests:
   ```bash
   npm test
   ```

## Documentation

- [API Reference](./docs/API.md)
- [Database Schema & Indexing](./docs/DATABASE.md)
- [Security Architecture](./docs/SECURITY.md)
- [Deployment & MongoDB Setup Guide](./docs/DEPLOYMENT.md)

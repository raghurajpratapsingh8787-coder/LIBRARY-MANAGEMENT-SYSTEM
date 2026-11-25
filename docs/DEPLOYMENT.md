# Deployment & MongoDB Setup Guide

## External MongoDB Configuration
For production deployments, provision a MongoDB Replica Set (e.g., MongoDB Atlas M0/M10+ or self-hosted 1-node/3-node replica set) so atomic transactions are supported:

1. Set `MONGODB_URI` in your environment secrets (e.g., `mongodb+srv://<user>:<password>@cluster.mongodb.net/library_management?retryWrites=true&w=majority`).
2. Set `ALLOWED_ORIGINS` to your production frontend origin (e.g., `https://library.yourdomain.com`).
3. Optionally set `ADMIN_INITIAL_EMAIL` and `ADMIN_INITIAL_PASSWORD` if provisioning unattended; otherwise, complete the first-run Super Admin setup form in the browser.

## Build & Run
```bash
npm run build
npm start
```

## Troubleshooting
- **Embedded MongoDB in dev**: When `MONGODB_URI` is empty, `backend/src/config/db.ts` starts an embedded `MongoMemoryReplSet` automatically. Data resets on server restart unless `MONGODB_URI` points to a persistent MongoDB instance.
- **Port 3000**: Ensure `PORT=3000` is available; Express serves both `/api/*` and the Vite-built SPA on the same port.

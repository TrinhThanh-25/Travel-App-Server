# Deploy to Railway

This backend is ready to deploy on Railway using Nixpacks (no Dockerfile required).

## Prerequisites

- A Railway account
- Railway CLI installed: `npm i -g railway`
- This repo connected to Railway (GitHub)

## Environment

Create a `.env` on Railway (Variables tab) based on `.env.example`:

- `PORT`: 3000 (Railway will inject `PORT`)
- `CORS_ORIGIN`: `*` (or your frontend URL)
- `CHAT_API_URL`: optional (external Python chat API if used)
- `DB_PATH`: `./travel_app.template.db` (server overrides to this by default)

## Start command

Railway will detect Node and run the `start` script:

```bash
npm start
```

This runs `server.js`, which listens on `process.env.PORT`.

## Static client

The server serves files from `client/` at the root. Visiting `/<file>` will load static assets (e.g., `/index.html`).

## Health

Visit `/api` for a simple status JSON.

## Database

SQLite file `travel_app.template.db` is committed. On Railway’s ephemeral filesystem, it will be available at runtime.
If you seed/import new data, commit the updated DB or add scripts to re-import on deploy.

## Optional post-deploy task

If you want to recompute location ratings based on review data after import:

- Run the SQL update we used during local dev (ask to add a script to automate this if desired).

## Troubleshooting

- If the app fails to start, ensure `PORT` is set and not blocked.
- If CORS errors occur, set `CORS_ORIGIN` to your exact frontend URL.
- If Chat API proxy returns 501, set `CHAT_API_URL`.

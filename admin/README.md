# Unishop admin service

This directory is a standalone Railway service for the private admin console. It serves the admin UI and proxies `/api/*` to the marketplace API. It has no third-party runtime dependencies.

## Local run

```powershell
$env:ADMIN_PASSWORD = 'replace-with-a-local-admin-secret'
$env:MARKETPLACE_API_URL = 'http://localhost:3000'
npm start
```

Open `http://localhost:4173`. The marketplace API must also be running and configured with `ADMIN_PASSWORD`.

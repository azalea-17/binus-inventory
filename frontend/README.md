# BINUS Inventory — Frontend

Static HTML/CSS/JavaScript frontend prototype for a campus inventory application.

## Files
- `index.html` — dashboard and CRUD dialogs
- `style.css` — responsive styling
- `script.js` — search/filter, form validation, CRUD integration
- `nginx.conf` — serves static assets and proxies `/api/` to `backend:3000`
- `Dockerfile` — multi-stage build with an unprivileged Nginx runtime on port 8080

## Run locally without Docker
Follow the backend instructions in `../README.md`, then open `http://localhost:3000`. The Node server serves this frontend and its API together.

For UI-only work, set `DEMO_MODE = true` in `script.js` and open `index.html` in a browser. That optional mode stores changes in browser `localStorage`.

## Run with Docker Compose
This frontend Dockerfile expects a Compose service named `backend` listening on port `3000`, with API endpoints under `/api/items`. The Compose stack should expose the gateway at host port `8080`.

```bash
docker compose up --build -d
docker compose ps
```

Open `http://localhost:8080`.

## Backend API contract expected by this frontend
- `GET /api/items` returns an array, or `{ "items": [...] }`
- `POST /api/items` accepts JSON `{ "name", "code", "category", "location", "quantity", "status" }`
- `PUT /api/items/:id` accepts the same JSON object
- `DELETE /api/items/:id`

Each item should include `id`, `name`, `code`, `category`, `location`, `quantity`, and `status`. Status values are `available`, `borrowed`, and `maintenance`. Category values are `Elektronik`, `Furnitur`, `Laboratorium`, and `Perlengkapan`.

## Connect to the real backend
`DEMO_MODE = false` is the default in `script.js`. Requests use relative `/api` paths, so the browser uses the same origin and the Nginx proxy forwards them to the backend. No browser-side CORS configuration is needed.

**Important:** demo mode uses `localStorage` and is only for frontend development. It does not demonstrate PostgreSQL persistence. For the final project, use `DEMO_MODE = false` and verify that the backend writes to PostgreSQL.

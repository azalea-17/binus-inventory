# BINUS Inventory

A campus inventory dashboard with a small Express API and PostgreSQL database. The frontend is served by Nginx and talks to the backend through `/api`.

## Run locally

1. Install and start Docker Desktop.
2. From this directory, copy `.env.example` to `.env` if `.env` does not already exist. Set `WEB_PORT=8081` to choose the local web port.
3. Start the app:

   ```powershell
   docker compose up --build -d --wait
   ```

4. Open [http://localhost:8081](http://localhost:8081). Change the URL if you selected a different `WEB_PORT`.
5. Stop the app with `docker compose down`. Add `-v` only if you want to delete the local database data.

See [RUN_LOCALLY.md](RUN_LOCALLY.md) for complete steps and troubleshooting, and [SYSTEM_THEORY.md](SYSTEM_THEORY.md) for the architecture and design rationale.

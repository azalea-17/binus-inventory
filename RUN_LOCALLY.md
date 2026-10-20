# Run BINUS Inventory locally

The Docker Compose setup runs the frontend, backend, and PostgreSQL together. Start Docker Desktop with Linux containers before following these steps.

## 1. Open PowerShell in the project folder

```powershell
cd "C:\Users\HP\project cloud service\binus-inventory"
```

## 2. Set the local web port

If you already have this project `.env`, keep its `WEB_PORT` setting. The current local setup uses port `8081` because port `8080` was occupied. For a fresh copy, create `.env` from `.env.example` and set `WEB_PORT=8081` if you need that port.

## 3. Build and start the app

```powershell
docker compose up --build -d --wait
```

The first start can take a few minutes while Docker downloads the images.

## 4. Open the app and check the API

When `WEB_PORT=8081`, open [http://localhost:8081](http://localhost:8081).

```powershell
docker compose ps
Invoke-RestMethod http://localhost:8081/api/health
```

The three services should show `healthy`; the health response should report `status: ok` and `database: connected`.

## 5. Add optional sample records

The inventory starts empty. To add the seven example records:

```powershell
docker compose exec backend npm run seed
```

Seeded asset codes are skipped on later runs, so existing records are kept.

## Stop and start the app

Stop the containers and keep inventory data:

```powershell
docker compose down
```

Start again:

```powershell
docker compose up -d --wait
```

Inventory is stored in a Docker volume. `docker compose down -v` deletes that volume and its data.

## Troubleshoot

```powershell
docker compose logs --tail=50 backend db frontend
```

If the web port is already in use, set `WEB_PORT` in `.env` to an unused port, start again, and use that port in the browser URL.

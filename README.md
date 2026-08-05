# Conexia

## Project structure

```text
Conexia/
|-- backend/   Laravel API and database migrations
`-- frontend/  React and Vite application
```

Each application has its own `.env` file. Backend database credentials must
remain in `backend/.env`; only browser-safe `VITE_*` values belong in
`frontend/.env`.

## Development

Install the frontend dependencies once:

```powershell
npm --prefix frontend install
```

Then start both applications from the project root:

```powershell
npm run dev
```

To run only the frontend, use `npm run dev:frontend`.

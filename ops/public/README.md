# Public Deploy Bundle

This bundle serves the visitor guide as plain static files.

Contents expected in the deployed folder:

- `dist/`
- `Caddyfile`
- `docker-compose.yml`
- `.env`

Setup:

1. Copy `.env.example` to `.env`
2. Set `SITE_HOST` to the public hostname
3. Run `docker compose up -d`

The public deployment does not need studio secrets or a database.

# Optional Hosted Studio

This stack is optional and keeps the authoring surface separate from the public guide.

Requirements:

- a checked-out repository on the host
- a populated root `.env` with API keys and show settings
- `.env` in this folder with:
  - `STUDIO_HOST`
  - `STUDIO_USERNAME`
  - `STUDIO_PASSWORD_HASH`
  - `STUDIO_SESSION_TOKEN`

Create the password hash with:

```bash
caddy hash-password --plaintext 'your-password'
```

Generate a session token as well, for example:

```bash
openssl rand -base64 24 | tr '+/' '-_' | tr -d '='
```

Then run:

```bash
docker compose up -d --build
```

The proxy applies HTTP Basic Auth to the whole studio surface.

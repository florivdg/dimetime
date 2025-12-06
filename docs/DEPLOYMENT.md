# DimeTime Deployment Guide

This guide covers deploying DimeTime in a production environment using Docker and Traefik as a reverse proxy.

## Prerequisites

- Docker and Docker Compose v2+
- An existing Traefik installation with:
  - External network named `traefik_system_traefik` (matches the compose file)
  - Entrypoint `websecure` (port 443)
  - Certificate resolver `le` (using Let's Encrypt)
- A domain name pointing to your server

## Quick Start

1. **Create a deployment directory:**

   ```bash
   mkdir -p /opt/dimetime && cd /opt/dimetime
   ```

2. **Download the production compose file:**

   ```bash
   curl -o docker-compose.yml https://raw.githubusercontent.com/florivdg/dimetime/main/docker-compose.prod.yml
   curl -o .env https://raw.githubusercontent.com/florivdg/dimetime/main/.env.production.example
   ```

3. **Configure environment variables:**

   Edit `.env` and set your values (see [Environment Variables](#environment-variables)).

4. **Start the application:**

   ```bash
   docker compose up -d
   ```

5. **Create your first user:**

   ```bash
   docker compose exec dimetime bun run add-user.js
   ```

   Follow the prompts to set up your admin account.

## Environment Variables

| Variable             | Description                                    | Example                     |
| -------------------- | ---------------------------------------------- | --------------------------- |
| `DOMAIN`             | Your domain for Traefik routing                | `money.example.com`         |
| `BETTER_AUTH_SECRET` | 32-byte base64 secret for session encryption   | (generate with openssl)     |
| `BETTER_AUTH_URL`    | Full URL of your application                   | `https://money.example.com` |
| `PASSKEY_RP_ID`      | WebAuthn relying party ID (domain without URL) | `money.example.com`         |
| `PASSKEY_ORIGIN`     | WebAuthn origin (full URL with protocol)       | `https://money.example.com` |

### Generating the Auth Secret

```bash
openssl rand -base64 32
```

## Traefik Integration

The production compose file includes Traefik labels for automatic routing. If your Traefik setup differs, adjust these labels in `docker-compose.yml`:

```yaml
labels:
  - traefik.enable=true
  - traefik.http.routers.dimetime.rule=Host(`${DOMAIN}`)
  - traefik.http.routers.dimetime.entrypoints=websecure
  - traefik.http.routers.dimetime.tls.certresolver=le
  - traefik.http.services.dimetime.loadbalancer.server.port=4321
    - traefik.docker.network=traefik_system_traefik
```

**Common adjustments:**

- Change `websecure` to your HTTPS entrypoint name
- Change `le` to your certificate resolver name
- Change `traefik_system_traefik` network name if different (ensure the service attaches to the same external network)

## Database Backups

DimeTime uses SQLite with WAL (Write-Ahead Logging) mode. The database consists of three files:

- `sqlite.db` - Main database file
- `sqlite.db-wal` - Write-ahead log
- `sqlite.db-shm` - Shared memory file

### Backup Strategy

**Important:** Always back up all three files together for consistency.

1. **Locate the data volume:**

   ```bash
   docker volume inspect dimetime_dimetime-data
   ```

2. **Create a backup:**

   ```bash
   # Stop the container for consistent backup
   docker compose stop

   # Copy the database files
   docker run --rm \
     -v dimetime_dimetime-data:/data \
     -v $(pwd)/backups:/backup \
     alpine tar czf /backup/dimetime-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .

   # Restart the container
   docker compose start
   ```

3. **Automated backups (cron example):**

   ```bash
   # Add to crontab -e
   0 3 * * * cd /opt/dimetime && ./backup.sh
   ```

### Restore from Backup

```bash
docker compose stop

docker run --rm \
  -v dimetime_dimetime-data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/dimetime-YYYYMMDD-HHMMSS.tar.gz -C /data"

docker compose start
```

## User Management

DimeTime includes a CLI tool for user management. New user registration is disabled by default in production.

### Add a New User

```bash
docker compose exec dimetime bun run add-user.js
```

You will be prompted for:

- Email address
- Password (minimum 16 characters)
- Name

### Reset a User's Password

Currently, password resets require direct database access or using the add-user script to create a new account.

## Updating the Application

1. **Pull the latest image:**

   ```bash
   docker compose pull
   ```

2. **Recreate the container:**

   ```bash
   docker compose up -d
   ```

   Database migrations run automatically on startup.

3. **Verify the update:**

   ```bash
   docker compose logs -f
   ```

   Look for successful migration and startup messages.

### Pinning to a Specific Version

To use a specific version instead of `latest`:

```yaml
# In docker-compose.yml
image: ghcr.io/florivdg/dimetime:1.0.0
```

Available tags follow semantic versioning: `1`, `1.0`, `1.0.0`, `latest`.

## Security Considerations

The production setup includes several security hardening measures:

- **Read-only filesystem:** Only `/data` and `/tmp` are writable
- **No privilege escalation:** `no-new-privileges` security option
- **Non-root user:** Container runs as the `bun` user
- **Init process:** Proper signal handling with `init: true`
- **Secure cookies:** Enabled automatically when `NODE_ENV=production`
- **Rate limiting:** Built-in protection against brute-force attacks

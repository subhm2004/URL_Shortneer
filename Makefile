.PHONY: up up-local down logs restart build clean reset migrate psql

# BSD sed (macOS) requires an argument to -i; GNU sed (Linux) must not get one.
SED_INPLACE := $(shell sed --version >/dev/null 2>&1 && echo "sed -i" || echo "sed -i ''")

# Create .env from .env.example on first run and generate a JWT_SECRET if empty.
define ensure_env
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env from .env.example"; fi
	@SECRET_LINE=$$(grep '^JWT_SECRET=' .env || echo ""); \
	if [ -z "$$SECRET_LINE" ] || [ "$$SECRET_LINE" = "JWT_SECRET=" ]; then \
		SECRET=$$(openssl rand -hex 32); \
		$(SED_INPLACE) "s|^JWT_SECRET=.*|JWT_SECRET=$$SECRET|" .env; \
		echo "Generated JWT_SECRET in .env"; \
	fi
endef

# Uses the DATABASE_URL in .env (Neon, Supabase, …). No database container runs.
up:
	$(ensure_env)
	@if ! grep -q '^DATABASE_URL=.\+' .env; then \
		echo ""; \
		echo "  DATABASE_URL is empty in .env."; \
		echo "  Either paste your Postgres connection string into it, or run:  make up-local"; \
		echo ""; \
		exit 1; \
	fi
	docker compose up -d --build
	@echo ""
	@echo "Trunc is starting → $${PUBLIC_BASE_URL:-http://localhost} (host port $${UI_PORT:-80})"
	@echo "Follow logs with: make logs"

# Runs a Postgres container alongside the app — no external database needed.
up-local:
	$(ensure_env)
	docker compose --profile local-db up -d --build
	@echo ""
	@echo "Trunc is starting with a local Postgres container."
	@echo "Follow logs with: make logs"

down:
	docker compose --profile local-db down

logs:
	docker compose logs -f

restart:
	docker compose restart

build:
	docker compose build

# Migrations also run automatically at backend boot; this is for running them by hand.
migrate:
	docker compose exec backend npm run migrate

# Opens a psql shell against the local-db container.
psql:
	docker compose exec postgres psql -U trunc -d trunc

# Stops services and removes containers/network. Keeps the postgres_data volume.
clean:
	docker compose --profile local-db down --remove-orphans

# Stops services AND deletes the postgres_data volume. Destroys local data.
reset:
	docker compose --profile local-db down --volumes --remove-orphans

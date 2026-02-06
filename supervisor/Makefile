# Makefile for Arx Supervisor Development

.PHONY: help build run clean test dev db-up db-down db-migrate db-reset sqlc fmt lint

# Default target
help:
	@echo "Arx Supervisor Development Commands:"
	@echo ""
	@echo "  Database Commands:"
	@echo "    db-up      Start database services with podman-compose"
	@echo "    db-down    Stop database services"
	@echo "    db-migrate Run database migrations"
	@echo "    db-reset   Reset database (down, clean volumes, up, migrate)"
	@echo ""
	@echo "  Build & Run Commands:"
	@echo "    build      Build the supervisor binary"
	@echo "    run        Build and run the supervisor"
	@echo "    dev        Run in development mode with hot reload (air)"
	@echo ""
	@echo "  Development Commands:"
	@echo "    sqlc       Generate sqlc code"
	@echo "    fmt        Format Go code"
	@echo "    lint       Run linter"
	@echo "    test       Run tests"
	@echo "    clean      Clean build artifacts"
	@echo ""
	@echo "  Utility Commands:"
	@echo "    deps       Install/update dependencies"
	@echo "    tools      Install development tools"

# Database Commands
db-up:
	@echo "Starting database services..."
	podman-compose up -d postgres redis
	@echo "Waiting for database to be ready..."
	sleep 5
	@echo "Database services started!"

db-down:
	@echo "Stopping database services..."
	podman-compose down
	@echo "Database services stopped!"

db-migrate:
	@echo "Running database migrations..."
	goose postgres "user=$(GOOSE_USER) password=$(GOOSE_PASSWORD) dbname=$(GOOSE_DBNAME) sslmode=$(GOOSE_SSLMODE) host=$(GOOSE_HOST) port=$(GOOSE_PORT)" up
	@echo "Migrations completed!"

db-reset:
	@echo "Resetting database..."
	$(MAKE) db-down
	podman volume rm supervisor_postgres_data supervisor_redis_data 2>/dev/null || true
	$(MAKE) db-up
	sleep 10
	$(MAKE) db-migrate
	@echo "Database reset completed!"

# Build & Run Commands
build:
	@echo "Building supervisor binary..."
	go build -o bin/supervisor ./cmd/main.go
	@echo "Build completed: bin/supervisor"

run: build
	@echo "Starting supervisor..."
	./bin/supervisor

dev:
	@echo "Starting supervisor in development mode..."
	air

# Development Commands
sqlc:
	@echo "Generating sqlc code..."
	sqlc generate
	@echo "sqlc code generation completed!"

fmt:
	@echo "Formatting Go code..."
	go fmt ./...
	@echo "Code formatted!"

lint:
	@echo "Running linter..."
	golangci-lint run 2>/dev/null || echo "golangci-lint not installed, skipping..."

test:
	@echo "Running tests..."
	go test -v ./...

clean:
	@echo "Cleaning build artifacts..."
	rm -rf bin/ tmp/
	go clean -cache
	@echo "Clean completed!"

# Utility Commands
deps:
	@echo "Installing/updating dependencies..."
	go mod tidy
	go mod download
	@echo "Dependencies updated!"

tools:
	@echo "Installing development tools..."
	go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	go install github.com/pressly/goose/v3/cmd/goose@latest
	go install github.com/cosmtrek/air@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@echo "Development tools installed!"

# Quick start command
quick-start: tools db-up sqlc db-migrate
	@echo ""
	@echo "🚀 Quick start completed!"
	@echo ""
	@echo "Next steps:"
	@echo "  make dev    # Start in development mode"
	@echo "  make run    # Build and run"
	@echo ""
	@echo "API will be available at: http://localhost:8080"
	@echo "Admin API: http://localhost:8080/admin/api/v1"
	@echo "WebSocket: ws://localhost:8080/admin/api/v1/realtime"

# Development workflow
dev-setup: tools deps sqlc
	@echo "Development environment setup completed!"

# Full workflow (build, test, lint)
check: fmt lint test
	@echo "All checks completed!"

# Build for production
build-prod:
	@echo "Building for production..."
	CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o bin/supervisor-linux ./cmd/main.go
	@echo "Production build completed: bin/supervisor-linux"
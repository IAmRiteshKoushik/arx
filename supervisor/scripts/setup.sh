#!/bin/bash
set -e

echo "Setting up Arx Supervisor..."

# Create project structure if it doesn't exist
mkdir -p cmd internal/{database,routing,api,models,websocket,health,config} db/{migrations,queries} config docs scripts

# Install Go dependencies
echo "Installing Go dependencies..."
go get -u github.com/gin-gonic/gin
go get -u github.com/lib/pq
go get -u github.com/jackc/pgx/v5/stdlib
go get -u github.com/jackc/pgx/v5/pgxpool
go get -u github.com/sirupsen/logrus
go get -u github.com/gorilla/websocket
go get -u github.com/google/uuid
go get -u github.com/joho/godotenv

# Install development tools if not already installed
echo "Installing development tools..."
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
go install github.com/cosmtrek/air@latest

# Generate sqlc code
echo "Generating sqlc code..."
sqlc generate

echo "Setup completed! Next steps:"
echo "1. Start the database: docker-compose up -d postgres redis"
echo "2. Run migrations: goose postgres 'user=postgres password=password dbname=arx_supervisor sslmode=disable host=localhost port=5432' up"
echo "3. Start development server: air"
echo "4. Or build and run: go build -o supervisor ./cmd/main.go && ./supervisor"
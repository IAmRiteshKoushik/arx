package database

import (
	"context"
	"fmt"

	"arx-supervisor/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type Database struct {
	Pool    *pgxpool.Pool
	Queries *db.Queries
}

func NewDatabase(ctx context.Context, config Config) (*Database, error) {
	// Build connection string
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		config.Host, config.Port, config.User, config.Password, config.DBName, config.SSLMode)

	// Create connection pool
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Initialize sqlc queries
	queries := db.New(pool)

	return &Database{
		Pool:    pool,
		Queries: queries,
	}, nil
}

func (d *Database) Close() {
	if d.Pool != nil {
		d.Pool.Close()
	}
}

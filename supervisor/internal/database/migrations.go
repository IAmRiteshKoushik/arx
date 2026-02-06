package database

import (
	"context"
	"fmt"
	"log"

	"arx-supervisor/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

func SetupDatabase(ctx context.Context, cfg config.DatabaseConfig) (*Database, error) {
	// First connect without specifying database to create it if needed
	masterDSN := fmt.Sprintf("host=%s port=%d user=%s password=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.SSLMode)

	masterPool, err := pgxpool.New(ctx, masterDSN)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to postgres server: %w", err)
	}
	defer masterPool.Close()

	// Create database if it doesn't exist
	_, err = masterPool.Exec(ctx, fmt.Sprintf("CREATE DATABASE %s", cfg.DBName))
	if err != nil {
		// Database might already exist, check error
		log.Printf("Warning creating database: %v", err)
	}

	// Now connect to the specific database
	return NewDatabase(ctx, Config{
		Host:     cfg.Host,
		Port:     cfg.Port,
		User:     cfg.User,
		Password: cfg.Password,
		DBName:   cfg.DBName,
		SSLMode:  cfg.SSLMode,
	})
}

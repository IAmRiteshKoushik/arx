package config

import (
	"os"
	"strconv"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Routing  RoutingConfig
	Health   HealthConfig
}

type ServerConfig struct {
	Port string
	Host string
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type RoutingConfig struct {
	KNearest       int
	MaxDistance    float64
	LoadWeight     float64
	DistanceWeight float64
}

type HealthConfig struct {
	CheckInterval    int
	Timeout          int
	FailureThreshold int
}

func Load() Config {
	return Config{
		Server: ServerConfig{
			Port: getEnv("SERVER_PORT", "8080"),
			Host: getEnv("SERVER_HOST", "0.0.0.0"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnvInt("DB_PORT", 5432),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "password"),
			DBName:   getEnv("DB_NAME", "arx_supervisor"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		Routing: RoutingConfig{
			KNearest:       getEnvInt("K_NEAREST", 3),
			MaxDistance:    getEnvFloat("MAX_DISTANCE", 50.0),
			LoadWeight:     getEnvFloat("LOAD_WEIGHT", 0.6),
			DistanceWeight: getEnvFloat("DISTANCE_WEIGHT", 0.4),
		},
		Health: HealthConfig{
			CheckInterval:    getEnvInt("HEALTH_CHECK_INTERVAL", 30),
			Timeout:          getEnvInt("HEALTH_TIMEOUT", 5),
			FailureThreshold: getEnvInt("HEALTH_FAILURE_THRESHOLD", 3),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}

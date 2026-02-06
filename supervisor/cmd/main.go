package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"arx-supervisor/internal/api"
	"arx-supervisor/internal/config"
	"arx-supervisor/internal/database"
	"arx-supervisor/internal/health"
	"arx-supervisor/internal/routing"
	"arx-supervisor/internal/websocket"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize database
	database, err := database.SetupDatabase(ctx, cfg.Database)
	if err != nil {
		log.Fatal("Failed to setup database:", err)
	}
	defer database.Close()

	log.Println("Database connected successfully")

	// Initialize WebSocket hub
	wsHub := websocket.NewHub()
	go wsHub.Run()

	// Initialize health monitor
	healthMonitor := health.NewMonitor(database, wsHub, time.Duration(cfg.Health.CheckInterval)*time.Second)
	go healthMonitor.Start()

	// Initialize routing service
	routingService := routing.NewService(database)

	// Setup router
	r := gin.Default()

	// Enable CORS for admin dashboard
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// WebSocket endpoint
	r.GET("/admin/api/v1/realtime", wsHub.HandleWebSocket)

	// Public API
	publicHandler := api.NewPublicHandler(database, routingService, wsHub)
	public := r.Group("/api/v1")
	{
		public.POST("/route", publicHandler.RouteRequest)
		public.GET("/nodes", publicHandler.GetNodes)
		public.POST("/nodes/register", publicHandler.RegisterNode)
		public.GET("/health", publicHandler.Health)
	}

	// Admin API
	adminHandler := api.NewAdminHandler(database, wsHub)
	admin := r.Group("/admin/api/v1")
	{
		// Node CRUD operations
		admin.GET("/nodes", adminHandler.GetAllNodes)
		admin.POST("/nodes", adminHandler.CreateNode)
		admin.PUT("/nodes/:id", adminHandler.UpdateNode)
		admin.DELETE("/nodes/:id", adminHandler.DeleteNode)

		// Dashboard and metrics
		admin.GET("/dashboard/metrics", adminHandler.GetDashboardMetrics)
		admin.GET("/requests/export", adminHandler.ExportRequests)
	}

	// Start server in a goroutine
	srv := &http.Server{
		Addr:    cfg.Server.Host + ":" + cfg.Server.Port,
		Handler: r,
	}

	go func() {
		log.Printf("Server starting on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Server failed to start:", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Shutdown HTTP server
	ctx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited")
}

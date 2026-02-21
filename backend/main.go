package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/joho/godotenv"
)

//go:embed all:public
var staticFiles embed.FS

var cfg Config

func main() {
	godotenv.Load("../.env", ".env")

	cfg = loadConfig()

	log.SetFlags(log.LstdFlags | log.Lshortfile)

	initTorrentClient()

	buildFS, err := fs.Sub(staticFiles, "public")
	if err != nil {
		log.Fatal(err)
	}
	fileServer := http.FileServer(http.FS(buildFS))

	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/torrent", handleAddTorrent)
	mux.HandleFunc("GET /api/stream/{hash}/{fileIdx}", handleStream)
	mux.HandleFunc("GET /api/search", handleSearch)
	mux.HandleFunc("GET /api/movie", handleMovie)
	mux.HandleFunc("GET /api/show", handleShow)
	mux.HandleFunc("GET /api/season", handleSeason)
	mux.HandleFunc("GET /api/episode", handleEpisode)
	mux.HandleFunc("GET /api/indexer", handleIndexer)

	mux.Handle("/", spaHandler(buildFS, fileServer))

	server := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: withSecurityHeaders(mux),
	}

	go func() {
		log.Printf("Server listening on :%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("Shutting down...")
	server.Shutdown(context.Background())
}

func withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Embedder-Policy", "credentialless")
		next.ServeHTTP(w, r)
	})
}

func spaHandler(fsys fs.FS, fileServer http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		_, err := fs.Stat(fsys, path)
		if err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}

		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}

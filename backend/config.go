package main

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port                  string
	TorrentPort           int
	DownloadDir           string
	TorrentStorageLimitGB float64
	TmdbApiKey            string
	ProwlarrBaseUrl       string
	ProwlarrApiKey        string
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("missing required environment variable: %s", key))
	}
	return v
}

func loadConfig() Config {
	torrentPort, _ := strconv.Atoi(getEnv("TORRENT_PORT", "42069"))
	storageLimitGB, _ := strconv.ParseFloat(getEnv("TORRENT_STORAGE_LIMIT_GB", "50"), 64)
	return Config{
		Port:                  getEnv("PORT", "8080"),
		TorrentPort:           torrentPort,
		DownloadDir:           getEnv("DOWNLOAD_DIR", "./downloads"),
		TorrentStorageLimitGB: storageLimitGB,
		TmdbApiKey:            requireEnv("TMDB_API_KEY"),
		ProwlarrBaseUrl:       requireEnv("PROWLARR_BASE_URL"),
		ProwlarrApiKey:        requireEnv("PROWLARR_API_KEY"),
	}
}

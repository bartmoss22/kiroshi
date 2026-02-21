package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/metainfo"
)

const (
	cleanupInterval      = 5 * time.Minute
	torrentTTL           = 15 * time.Minute
	maxRatio             = 2.0
	torrentClientTimeout = 60 * time.Second
)

var (
	tClient      *torrent.Client
	lastAccessed sync.Map
)

type addTorrentRequest struct {
	SourceUrl string `json:"sourceUrl"`
	Season    int    `json:"season,omitempty"`
	Episode   int    `json:"episode,omitempty"`
}

type streamResponse struct {
	StreamUrl string `json:"streamUrl"`
	FileName  string `json:"fileName"`
}

func initTorrentClient() {
	log.Println("Initializing torrent client...")
	c := torrent.NewDefaultClientConfig()
	c.DataDir = cfg.DownloadDir
	c.NoDefaultPortForwarding = true
	c.ListenPort = cfg.TorrentPort
	c.EstablishedConnsPerTorrent = 500
	c.TorrentPeersHighWater = 1000
	c.TorrentPeersLowWater = 100
	c.HandshakesTimeout = 4 * time.Second
	c.NoUpload = false
	c.Seed = true
	c.Debug = false
	c.Slogger = slog.Default()

	var err error
	tClient, err = torrent.NewClient(c)
	if err != nil {
		log.Fatalf("Failed to create torrent client: %v", err)
	}
	log.Printf("Torrent client started on port %d", cfg.TorrentPort)

	go cleanupRoutine()
}

func handleAddTorrent(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req addTorrentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	log.Printf("[torrent] Add request: %s (S:%d E:%d)", req.SourceUrl, req.Season, req.Episode)

	t, err := resolveAndAdd(req.SourceUrl)
	if err != nil {
		log.Printf("[torrent] Failed to add: %v", err)
		http.Error(w, "Failed to resolve source: "+err.Error(), http.StatusInternalServerError)
		return
	}

	t.AddTrackers(DefaultTrackers)

	ih := t.InfoHash().HexString()

	ctx, cancel := context.WithTimeout(r.Context(), torrentClientTimeout)
	defer cancel()

	select {
	case <-t.GotInfo():
		log.Printf("[torrent] Metadata received for %s (%s)", t.Name(), ih)
	case <-ctx.Done():
		t.Drop()
		http.Error(w, "Timeout waiting for torrent metadata", http.StatusGatewayTimeout)
		return
	}

	fileIdx, file := selectFile(t, req.Season, req.Episode)
	if file == nil {
		http.Error(w, "No suitable video file found", http.StatusNotFound)
		return
	}

	updateAccess(ih)
	file.SetPriority(torrent.PiecePriorityHigh)
	file.Download()

	resp := streamResponse{
		StreamUrl: fmt.Sprintf("/api/stream/%s/%d", ih, fileIdx),
		FileName:  file.DisplayPath(),
	}

	log.Printf("[torrent] Ready in %s: %s", time.Since(start), file.DisplayPath())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func handleStream(w http.ResponseWriter, r *http.Request) {
	hashStr := r.PathValue("hash")
	fileIdxStr := r.PathValue("fileIdx")

	var ih metainfo.Hash
	if err := ih.FromHexString(hashStr); err != nil {
		http.Error(w, "Invalid infohash", http.StatusBadRequest)
		return
	}

	t, ok := tClient.Torrent(ih)
	if !ok {
		http.Error(w, "Torrent not found", http.StatusNotFound)
		return
	}

	updateAccess(t.InfoHash().String())

	idx, err := strconv.Atoi(fileIdxStr)
	if err != nil {
		http.Error(w, "Invalid file index", http.StatusBadRequest)
		return
	}

	files := t.Files()
	if idx < 0 || idx >= len(files) {
		http.Error(w, "File index out of bounds", http.StatusNotFound)
		return
	}

	file := files[idx]
	log.Printf("[stream] Serving: %s", file.DisplayPath())

	reader := file.NewReader()
	reader.SetResponsive()
	reader.SetReadahead(50 * 1024 * 1024)
	defer reader.Close()

	http.ServeContent(w, r, file.DisplayPath(), time.Time{}, reader)
}

func resolveAndAdd(sourceUrl string) (*torrent.Torrent, error) {
	if strings.HasPrefix(sourceUrl, "magnet:") {
		return tClient.AddMagnet(sourceUrl)
	}

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if req.URL.Scheme == "magnet" {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}

	resp, err := client.Get(sourceUrl)
	if err != nil {
		if urlErr, ok := err.(*url.Error); ok && strings.HasPrefix(urlErr.URL, "magnet:") {
			return tClient.AddMagnet(urlErr.URL)
		}
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusMovedPermanently || resp.StatusCode == http.StatusFound || resp.StatusCode == http.StatusSeeOther {
		loc, _ := resp.Location()
		if loc != nil && loc.Scheme == "magnet" {
			return tClient.AddMagnet(loc.String())
		}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	mi, err := metainfo.Load(bytes.NewReader(body))
	if err == nil {
		return tClient.AddTorrent(mi)
	}

	bodyStr := string(body)
	if strings.HasPrefix(strings.TrimSpace(bodyStr), "magnet:") {
		return tClient.AddMagnet(strings.TrimSpace(bodyStr))
	}

	return nil, errors.New("unrecognized source format")
}

func selectFile(t *torrent.Torrent, season, episode int) (int, *torrent.File) {
	files := t.Files()
	var videos []int
	videoExts := map[string]bool{".mkv": true, ".mp4": true, ".avi": true, ".mov": true, ".wmv": true, ".flv": true, ".webm": true}

	for i, f := range files {
		ext := strings.ToLower(filepath.Ext(f.Path()))
		if videoExts[ext] {
			videos = append(videos, i)
		}
	}

	if len(videos) == 0 {
		return -1, nil
	}

	if season > 0 && episode > 0 {
		regStandard := regexp.MustCompile(fmt.Sprintf(`(?i)s0*%d[\s._-]*e0*%d\b`, season, episode))
		regX := regexp.MustCompile(fmt.Sprintf(`(?i)\b%dx0*%d\b`, season, episode))

		for _, idx := range videos {
			name := files[idx].DisplayPath()
			if regStandard.MatchString(name) || regX.MatchString(name) {
				return idx, files[idx]
			}
		}
	}

	largestIdx := -1
	var maxSize int64
	for _, idx := range videos {
		if files[idx].Length() > maxSize {
			maxSize = files[idx].Length()
			largestIdx = idx
		}
	}

	if largestIdx != -1 {
		return largestIdx, files[largestIdx]
	}
	return -1, nil
}

func updateAccess(hash string) {
	lastAccessed.Store(hash, time.Now())
}

func cleanupRoutine() {
	ticker := time.NewTicker(cleanupInterval)
	for range ticker.C {
		var totalSize int64
		torrents := tClient.Torrents()

		for _, t := range torrents {
			infoHash := t.InfoHash().String()
			stats := t.Stats()
			totalSize += t.BytesCompleted()

			last, ok := lastAccessed.Load(infoHash)
			if !ok {
				last = time.Now()
				lastAccessed.Store(infoHash, last)
			}

			lastTime := last.(time.Time)
			inactiveDur := time.Since(lastTime)

			var ratio float64
			if stats.BytesRead.Int64() > 0 {
				ratio = float64(stats.BytesWritten.Int64()) / float64(stats.BytesRead.Int64())
			}

			if inactiveDur > torrentTTL || ratio >= maxRatio {
				t.Drop()
				lastAccessed.Delete(infoHash)
				continue
			}
		}

		maxBytes := int64(cfg.TorrentStorageLimitGB) * 1024 * 1024 * 1024
		if totalSize > maxBytes {
			type tSort struct {
				t    *torrent.Torrent
				last time.Time
			}
			var sorted []tSort

			for _, t := range tClient.Torrents() {
				last, _ := lastAccessed.Load(t.InfoHash().String())
				if last == nil {
					last = time.Time{}
				}
				sorted = append(sorted, tSort{t, last.(time.Time)})
			}

			sort.Slice(sorted, func(i, j int) bool {
				return sorted[i].last.Before(sorted[j].last)
			})

			for _, item := range sorted {
				if totalSize <= maxBytes {
					break
				}
				size := item.t.BytesCompleted()
				item.t.Drop()
				lastAccessed.Delete(item.t.InfoHash().String())
				totalSize -= size
			}
		}
	}
}

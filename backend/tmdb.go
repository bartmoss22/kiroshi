package main

import (
	"fmt"
	"io"
	"net/http"
	"strings"
)

func tmdbGet(path string, w http.ResponseWriter) {
	u := fmt.Sprintf("https://api.themoviedb.org/3%s", path)
	if strings.Contains(u, "?") {
		u += "&api_key=" + cfg.TmdbApiKey
	} else {
		u += "?api_key=" + cfg.TmdbApiKey
	}

	resp, err := http.Get(u)
	if err != nil {
		http.Error(w, "TMDB request failed", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")

	type searchResult struct {
		Movies []any `json:"movies"`
		Shows  []any `json:"shows"`
	}

	movieCh := make(chan []any, 1)
	showCh := make(chan []any, 1)

	go func() {
		url := fmt.Sprintf("https://api.themoviedb.org/3/search/movie?api_key=%s&query=%s", cfg.TmdbApiKey, q)
		data := fetchJSON(url)
		if results, ok := data["results"].([]any); ok {
			movieCh <- results
		} else {
			movieCh <- []any{}
		}
	}()

	go func() {
		url := fmt.Sprintf("https://api.themoviedb.org/3/search/tv?api_key=%s&query=%s", cfg.TmdbApiKey, q)
		data := fetchJSON(url)
		if results, ok := data["results"].([]any); ok {
			showCh <- results
		} else {
			showCh <- []any{}
		}
	}()

	movies := <-movieCh
	shows := <-showCh

	writeJSON(w, map[string]any{
		"movies": movies,
		"shows":  shows,
	})
}

func handleMovie(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	tmdbGet(fmt.Sprintf("/movie/%s?append_to_response=credits,videos,images", id), w)
}

func handleShow(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	tmdbGet(fmt.Sprintf("/tv/%s?append_to_response=credits,videos,images,external_ids", id), w)
}

func handleSeason(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	season := r.URL.Query().Get("season")
	if id == "" || season == "" {
		http.Error(w, "Missing required parameters", http.StatusBadRequest)
		return
	}
	tmdbGet(fmt.Sprintf("/tv/%s/season/%s", id, season), w)
}

func handleEpisode(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	season := r.URL.Query().Get("season")
	episode := r.URL.Query().Get("episode")
	if id == "" || season == "" || episode == "" {
		http.Error(w, "Missing required parameters", http.StatusBadRequest)
		return
	}
	tmdbGet(fmt.Sprintf("/tv/%s/season/%s/episode/%s?append_to_response=credits,videos,images,external_ids", id, season, episode), w)
}

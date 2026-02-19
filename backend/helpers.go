package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
)

func fetchJSON(url string) map[string]any {
	resp, err := http.Get(url)
	if err != nil {
		log.Printf("fetchJSON error for %s: %v", url, err)
		return map[string]any{}
	}
	defer resp.Body.Close()

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return map[string]any{}
	}
	return result
}

func fetchJSONSlice(url string) []any {
	resp, err := http.Get(url)
	if err != nil {
		log.Printf("fetchJSONSlice error for %s: %v", url, err)
		return []any{}
	}
	defer resp.Body.Close()

	var result []any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return []any{}
	}
	return result
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func proxyResponse(w http.ResponseWriter, resp *http.Response) {
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

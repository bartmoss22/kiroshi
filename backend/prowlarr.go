package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	cleanRegexYear        = regexp.MustCompile(`\b\d{4}\b`)
	cleanRegexCountry     = regexp.MustCompile(`\b(us|uk|au|ca)\b`)
	cleanRegexNonAlphanum = regexp.MustCompile(`[^a-z0-9]`)

	tvRegex         = regexp.MustCompile(`(?i)^(?P<title>.+?)[._\s](?:\[?\(?(?P<year>\d{4})\)?\]?[._\s])?[sS](?P<season>\d{1,2})[eE](?P<episode>\d{1,2})`)
	seasonPackRegex = regexp.MustCompile(`(?i)^(?P<title>.+?)[._\s](?:\[?\(?(?P<year>\d{4})\)?\]?[._\s])?[sS](?P<season>\d{1,2})`)
	movieRegex      = regexp.MustCompile(`(?i)^(?P<title>.+?)[._\s][\[\(]?(?P<year>\d{4})[\]\)]?`)
)

type prowlarrResult struct {
	Title       string `json:"title"`
	Guid        string `json:"guid"`
	Link        string `json:"link"`
	PubDate     string `json:"pubDate"`
	Category    string `json:"category"`
	Size        int64  `json:"size"`
	Seeders     int    `json:"seeders"`
	Leechers    int    `json:"leechers"`
	Resolution  int    `json:"resolution"`
	IndexerId   int    `json:"indexerId"`
	IndexerName string `json:"indexerName"`
}

func cleanTitle(t string) string {
	t = strings.ToLower(t)
	t = cleanRegexYear.ReplaceAllString(t, "")
	t = cleanRegexCountry.ReplaceAllString(t, "")
	t = cleanRegexNonAlphanum.ReplaceAllString(t, "")
	return t
}

func parseResolution(title string) int {
	re := regexp.MustCompile(`(?i)\b(\d{3,4}p|4k|8k|uhd)\b`)
	match := re.FindString(title)
	if match == "" {
		return 0
	}
	lower := strings.ToLower(match)
	if lower == "4k" || lower == "uhd" {
		return 2160
	}
	if lower == "8k" {
		return 4320
	}
	n, _ := strconv.Atoi(strings.TrimSuffix(lower, "p"))
	return n
}

func deduplicateResults(results []prowlarrResult) []prowlarrResult {
	seen := map[string]bool{}
	var out []prowlarrResult
	for _, r := range results {
		key := fmt.Sprintf("%s-%d", r.Title, r.Seeders)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, r)
	}
	return out
}

func mapToResult(item map[string]any) prowlarrResult {
	title, _ := item["title"].(string)
	guid, _ := item["guid"].(string)
	link, _ := item["downloadUrl"].(string)
	if link == "" {
		link, _ = item["magnetUrl"].(string)
	}
	if link == "" {
		link, _ = item["infoUrl"].(string)
	}
	pubDate, _ := item["publishDate"].(string)

	var category string
	if cats, ok := item["categories"].([]any); ok {
		var names []string
		for _, c := range cats {
			if cm, ok := c.(map[string]any); ok {
				if n, ok := cm["name"].(string); ok {
					names = append(names, n)
				}
			}
		}
		category = strings.Join(names, ",")
	}
	if category == "" {
		category = "Unknown"
	}

	var size int64
	switch v := item["size"].(type) {
	case float64:
		size = int64(v)
	case json.Number:
		size, _ = v.Int64()
	}

	seeders := 0
	if v, ok := item["seeders"].(float64); ok {
		seeders = int(v)
	}
	leechers := 0
	if v, ok := item["leechers"].(float64); ok {
		leechers = int(v)
	}
	indexerId := 0
	if v, ok := item["indexerId"].(float64); ok {
		indexerId = int(v)
	}
	indexer, _ := item["indexer"].(string)

	return prowlarrResult{
		Title:       title,
		Guid:        guid,
		Link:        link,
		PubDate:     pubDate,
		Category:    category,
		Size:        size,
		Resolution:  parseResolution(title),
		Seeders:     seeders,
		Leechers:    leechers,
		IndexerId:   indexerId,
		IndexerName: indexer,
	}
}

func fetchProwlarr(params map[string]string) []prowlarrResult {
	u, _ := url.Parse(strings.TrimRight(cfg.ProwlarrBaseUrl, "/") + "/api/v1/search")
	q := u.Query()
	for k, v := range params {
		q.Set(k, v)
	}
	u.RawQuery = q.Encode()

	client := &http.Client{Timeout: 8 * time.Second}
	req, _ := http.NewRequest("GET", u.String(), nil)
	req.Header.Set("X-Api-Key", cfg.ProwlarrApiKey)

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[prowlarr] fetch error: %v", err)
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	var items []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil
	}

	results := make([]prowlarrResult, 0, len(items))
	for _, item := range items {
		results = append(results, mapToResult(item))
	}
	return results
}

func namedGroup(re *regexp.Regexp, s string) map[string]string {
	match := re.FindStringSubmatch(s)
	if match == nil {
		return nil
	}
	result := map[string]string{}
	for i, name := range re.SubexpNames() {
		if i != 0 && name != "" {
			result[name] = match[i]
		}
	}
	return result
}

func getProwlarrMovie(imdbId, title, year string) []prowlarrResult {
	targetClean := cleanTitle(title)

	var mu sync.Mutex
	var idResults, textResults []prowlarrResult
	var wg sync.WaitGroup

	wg.Add(2)
	go func() {
		defer wg.Done()
		r := fetchProwlarr(map[string]string{"type": "movie", "query": fmt.Sprintf("{ImdbId:%s}", imdbId)})
		mu.Lock()
		idResults = r
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		r := fetchProwlarr(map[string]string{"type": "movie", "query": fmt.Sprintf("%s %s", title, year)})
		var filtered []prowlarrResult
		for _, item := range r {
			groups := namedGroup(movieRegex, item.Title)
			if groups == nil {
				continue
			}
			if groups["year"] != "" && groups["year"] != year {
				continue
			}
			if cleanTitle(groups["title"]) == targetClean {
				filtered = append(filtered, item)
			}
		}
		mu.Lock()
		textResults = filtered
		mu.Unlock()
	}()
	wg.Wait()

	return deduplicateResults(append(idResults, textResults...))
}

func getProwlarrEpisode(imdbId, title string, season, episode int) []prowlarrResult {
	targetClean := cleanTitle(title)
	sStr := fmt.Sprintf("%02d", season)
	eStr := fmt.Sprintf("%02d", episode)

	var mu sync.Mutex
	var idResults, textResults []prowlarrResult
	var wg sync.WaitGroup

	wg.Add(2)
	go func() {
		defer wg.Done()
		r := fetchProwlarr(map[string]string{
			"type":  "tvsearch",
			"query": fmt.Sprintf("{ImdbId:%s}{Season:%d}{Episode:%d}", imdbId, season, episode),
		})
		mu.Lock()
		idResults = r
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		r := fetchProwlarr(map[string]string{
			"type":  "tvsearch",
			"query": fmt.Sprintf("%s S%sE%s", title, sStr, eStr),
		})
		var filtered []prowlarrResult
		for _, item := range r {
			groups := namedGroup(tvRegex, item.Title)
			if groups == nil {
				continue
			}
			if s, _ := strconv.Atoi(groups["season"]); s != season {
				continue
			}
			if e, _ := strconv.Atoi(groups["episode"]); e != episode {
				continue
			}
			if cleanTitle(groups["title"]) == targetClean {
				filtered = append(filtered, item)
			}
		}
		mu.Lock()
		textResults = filtered
		mu.Unlock()
	}()
	wg.Wait()

	return deduplicateResults(append(idResults, textResults...))
}

func getProwlarrSeason(imdbId, title string, season int) []prowlarrResult {
	targetClean := cleanTitle(title)
	sStr := fmt.Sprintf("%02d", season)

	var mu sync.Mutex
	var idResults, textResults []prowlarrResult
	var wg sync.WaitGroup

	wg.Add(2)
	go func() {
		defer wg.Done()
		r := fetchProwlarr(map[string]string{
			"type":  "tvsearch",
			"query": fmt.Sprintf("{ImdbId:%s}{Season:%d}", imdbId, season),
		})
		mu.Lock()
		idResults = r
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		r := fetchProwlarr(map[string]string{
			"type":  "tvsearch",
			"query": fmt.Sprintf("%s S%s", title, sStr),
		})
		var filtered []prowlarrResult
		for _, item := range r {
			if tvRegex.MatchString(item.Title) {
				continue
			}
			groups := namedGroup(seasonPackRegex, item.Title)
			if groups == nil {
				continue
			}
			if s, _ := strconv.Atoi(groups["season"]); s != season {
				continue
			}
			if cleanTitle(groups["title"]) == targetClean {
				filtered = append(filtered, item)
			}
		}
		mu.Lock()
		textResults = filtered
		mu.Unlock()
	}()
	wg.Wait()

	return deduplicateResults(append(idResults, textResults...))
}

func handleIndexer(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	mediaType := q.Get("type")
	imdbId := strings.TrimPrefix(q.Get("imdbId"), "tt")
	title := q.Get("title")
	year := q.Get("year")
	season, _ := strconv.Atoi(q.Get("season"))
	episode, _ := strconv.Atoi(q.Get("episode"))

	if mediaType == "" || imdbId == "" || title == "" {
		http.Error(w, "Missing required parameters", http.StatusBadRequest)
		return
	}

	var results []prowlarrResult

	switch mediaType {
	case "movie":
		if year == "" {
			http.Error(w, "Missing year parameter", http.StatusBadRequest)
			return
		}
		results = getProwlarrMovie(imdbId, title, year)
	case "episode":
		var wg sync.WaitGroup
		var mu sync.Mutex
		var seasonResults, episodeResults []prowlarrResult

		wg.Add(2)
		go func() {
			defer wg.Done()
			r := getProwlarrSeason(imdbId, title, season)
			mu.Lock()
			seasonResults = r
			mu.Unlock()
		}()
		go func() {
			defer wg.Done()
			r := getProwlarrEpisode(imdbId, title, season, episode)
			mu.Lock()
			episodeResults = r
			mu.Unlock()
		}()
		wg.Wait()
		results = append(seasonResults, episodeResults...)
	default:
		http.Error(w, "Invalid type parameter", http.StatusBadRequest)
		return
	}

	if results == nil {
		results = []prowlarrResult{}
	}

	writeJSON(w, results)
}

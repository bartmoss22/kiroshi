export async function load({ url, fetch }) {
    const search = url.searchParams.get('q') ?? '';
    let movies = [];
    let shows = [];
    if (search) {
        const res = await fetch(`/api/search?q=${encodeURIComponent(search)}`);
        const data = await res.json();
        movies = data.movies;
        shows = data.shows;
    }
    return { search, movies, shows };
}
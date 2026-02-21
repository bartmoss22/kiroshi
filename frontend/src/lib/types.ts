export interface MovieInfo {
    mediaType: 'movie',
    title: string,
    releaseDate: string,
    tmdbId: string,
    imdbId: string,
    backdropPath: string,
}

export interface EpisodeInfo {
    mediaType: 'episode',
    showName: string,
    tmdbId: string,
    imdbId: string,
    episodeImdbId: string,
    episodeName: string,
    season: number,
    episode: number,
    releaseDate: string,
    backdropPath: string,
}

export type MediaInfo = MovieInfo | EpisodeInfo;

export interface ShowInfo {
    title: string,
    tmdbId: string,
    imdbId: string,
    releaseDate: string,
    backdropPath: string,
    episodeInfos: EpisodeInfo[][],
}
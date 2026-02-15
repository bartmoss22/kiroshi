# Kiroshi Media Server

## About

An automated real-time torrent streaming service. Utilizes [webtorrent](https://github.com/webtorrent/webtorrent) on the backend to allow byte-range requests to video torrents and [libmedia/avplayer](https://github.com/zhaohappy/libmedia) on the frontend to play basically any container or codec in the browser without the need for server-side transmuxing/transcoding. This has several advantages over existing solutions:

- Real-time playback: no need to build your own media library or wait for torrents to finish. Torrents are automatically seeded until a ratio of 1.0 (default) is reached to stay P2P friendly.

- No need for a VPN on the user's end: only the backend participates in torrent swarms

- Minimal server load: no need for server-side transcoding. Heavy tasks are offloaded to the client via [libmedia/avplayer](https://github.com/zhaohappy/libmedia) utilizing the [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) and [WebAssembly](https://webassembly.org/) under the hood

- Play anywhere: thanks to the awesome [libmedia/avplayer](https://github.com/zhaohappy/libmedia) library, virtually any video file is playable in most browsers including multiple audio/subtitle track support

## Deploying

No official Docker image has been built yet. To deploy, follow these steps:

1. Obtain a free TMDB api key

2. Depending on your country, you might want to put Kiroshi behind a VPN since the backend participates in torrent swarms. I recommend using [Gluetun](https://github.com/qdm12/gluetun).

3. Copy .env.example to .env and fill out **all** the variables. I have not made any variables optional (yet). If you use the ```docker-compose.yml``` from this repo, you will deploy Kiroshi together with a [Prowlarr](https://github.com/Prowlarr/Prowlarr) instance. Insert some random characters for ```PROWLARR_API_KEY``` for the initial start. You can then obtain and fill out the correct ```PROWLARR_API_KEY``` from the [Prowlarr](https://github.com/Prowlarr/Prowlarr) web ui.

4. Run ```docker compose up -d```

5. Configure [Prowlarr](https://github.com/Prowlarr/Prowlarr) such that Kiroshi can find torrents for you searches.

6. Done!

## TODO

- [] Build and deploy github docker image
- [] Add better documentation
- [] Add testing
- [] Add autoplay
- [] Auto-select source, provide a way to select a different source on demand
- [] Set up DB for account management
- [] Track playback progress in account
- [] Suggest movies/shows on search page

## Legal Disclaimer

**Please read this section carefully before using Kiroshi.**

1.  **Neutral Technology:** Kiroshi is a neutral peer-to-peer (P2P) utility designed to facilitate data transfer using the BitTorrent protocol. It is a tool, similar to a web browser, intended for accessing content the user has the legal right to view (e.g., open-source software, public domain creative works, or personal backups).
2.  **No Content Hosting:** The developers of Kiroshi **do not host, index, store, or distribute** any media files, torrent files, or magnet links. We have no control over the content found on P2P networks and do not operate any trackers.
3.  **User Responsibility:** It is strictly prohibited to use Kiroshi to infringe upon copyrights or to download/stream illegal content. The user assumes full responsibility for their actions. The developers shall not be held liable for any misuse of the software or for any copyright infringement committed by the user.

> **LIMITATION OF LIABILITY:**
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
# US Nuclear Power Plants – Interactive Map

Open `index.html` in any modern browser (works from a local file or any static host such as GitHub Pages, Netlify, or Cloudflare Pages). Leaflet 1.9.4 and Leaflet.markercluster 1.5.3 load from unpkg; basemap tiles come from Esri (with OpenStreetMap as an option).

Features
- Timeline
- Nearest plants
- EPZ rings
- Compare
- Stats
- Heat map
- License countdown
- Tour
- Share
- Estimated impact

Files
- `index.html` – the map app (search, reactor-type filter, status toggles in the legend, detail panel, deep links like `index.html#vogtle`)
- `data.js` – the embedded dataset (`window.PLANTS`), 90 plant sites / 148 reactor units
- `plants.json` – the same data as plain JSON
- `screenshots/*.png` – preview images (`screenshot.png`, `screenshot-details.png`, `screenshot-elkriver.png`, `screenshot-mobile.png`, `screenshot-waterford.png`)

Data sources (pulled 2026-11-12)
- Wikipedia, "List of commercial nuclear reactors" (United States section): unit type, model, status, net MW, construction start, commercial operation, and closure dates
- U.S. NRC, "List of Power Reactor Units": docket, license number, operator, and location for operating units
- U.S. NRC Information Digest 2024–2025 (NUREG-1350 Vol. 35), Appendix F: license expiration year (data as of Sep 2024)
- Wikipedia plant articles: coordinates, infobox location/operator/owner/cooling source, and the intro text
- Wikidata: fallback coordinates, location, operator, and image
- Wikimedia Commons: photos (each one credited, with its license and a link to the Commons file page)

Not an official product. Status values follow the sources as of the date above.

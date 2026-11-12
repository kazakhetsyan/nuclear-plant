# US Nuclear Power Plants – Interactive Map

Open `index.html` in any modern browser (works from a local file or any static host such as GitHub Pages, Netlify, or Cloudflare Pages). Leaflet 1.9.4, Leaflet.markercluster 1.5.3 and Leaflet.heat 0.2.0 are self-hosted in `vendor/` (with an unpkg fallback for Leaflet and markercluster); basemap tiles come from Esri (with OpenStreetMap as an option).

Files
- `index.html` – the map app (search, reactor-type filter, status toggles in the legend, detail panel, deep links like `index.html#vogtle`)
- `data.js` – the embedded dataset (`window.PLANTS`), 90 plant sites / 148 reactor units
- `plants.json` – the same data as plain JSON
- `features.js` / `features.css` – Tools menu: timeline, nearest plants, heat map, statistics, tour, grid regions; panel extras: EPZ rings, compare, share, license countdown, estimates, “Feeds” grid operator
- `data/grid-regions.geojson` – simplified ISO/RTO boundaries for the Grid regions layer (~105 KB, loaded only when the layer is turned on)
- `screenshot*.png` – preview images

Data sources (pulled 2026-11-12)
- Wikipedia, "List of commercial nuclear reactors" (United States section): unit type, model, status, net MW, construction start, commercial operation, and closure dates
- U.S. NRC, "List of Power Reactor Units": docket, license number, operator, and location for operating units
- U.S. NRC Information Digest 2024–2025 (NUREG-1350 Vol. 35), Appendix F: license expiration year (data as of Sep 2024)
- Wikipedia plant articles: coordinates, infobox location/operator/owner/cooling source, and the intro text
- Wikidata: fallback coordinates, location, operator, and image
- U.S. EIA, Form EIA-860 Annual Electric Generator Report (https://www.eia.gov/electricity/data/eia860/), Plant file (Schedule 2) "Balancing Authority Code/Name" and NERC region, matched by EIA plant ID to nuclear (NUC) generators. 2025 data for current plants; the 2021, 2019, 2014 and 2013 files for plants that retired before 2025 (Indian Point, Pilgrim, Duane Arnold, Vermont Yankee, Kewaunee). EIA-860 only lists balancing authorities from 2013 on, so plants closed earlier (and never-built or not-yet-filed projects) have no "Feeds" value (`grid: null`). Display names are shortened (e.g. "Midcontinent Independent Transmission System Operator, Inc." → "Midcontinent ISO"; the raw EIA name is kept in `grid.ba_name_eia`); "Duke Energy Florida" is EIA's BA code FPC, listed by EIA as "Progress Energy Florida". Interconnection is derived from the BA (ERCOT → Texas; CAISO, SRP, BPA, PacifiCorp East → Western; all others → Eastern).
- HIFLD "Independent System Operators" boundaries (Oak Ridge National Laboratory; source date June 2020), retrieved from the PASDA mirror (https://www.pasda.psu.edu/uci/DataSummary.aspx?dataset=9103) and simplified with mapshaper (15% Visvalingam, 0.001° precision). Approximate service areas; region counts in the app use each plant's EIA-860 balancing authority, not the polygon it falls in.
- Wikimedia Commons: photos (each one credited, with its license and a link to the Commons file page)

Estimates (homes powered, CO₂ avoided) use a 90% capacity factor, 10,500 kWh per home per year and 0.4 kg CO₂/kWh (EIA). NRC emergency planning zones: https://www.nrc.gov/about-nrc/emerg-preparedness/about-emerg-preparedness/planning-zones.html

Not an official product. Status values follow the sources as of the date above.

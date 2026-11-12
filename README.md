# World Nuclear Power Plants – Interactive Map

Open `index.html` in any modern browser (works from a local file or any static host such as GitHub Pages, Netlify, or Cloudflare Pages). Leaflet 1.9.4, Leaflet.markercluster 1.5.3 and Leaflet.heat 0.2.0 are self-hosted in `vendor/` (with an unpkg fallback for Leaflet and markercluster); basemap tiles come from Esri (with OpenStreetMap as an option).

Files
- `index.html` – the map app (search by plant, country, state or operator; reactor-type filter; status toggles in the legend; World / USA quick-zoom buttons; detail panel; deep links like `index.html#vogtle` or `index.html#zaporizhzhia`)
- `data.js` – US dataset (`window.PLANTS`), 90 plant sites / 148 reactor units; loaded first
- `plants.json` – the same US data as plain JSON (fallback)
- `world.js` – the other 210 sites in 39 countries / 610 reactor units (`window.WORLD_PLANTS`, ~417 KB), loaded after the US map is up so phones get a fast first paint; `world.json` is the same data, used if world.js fails twice
- `features.js` / `features.css` – Tools menu: countries, timeline (1954–today), nearest plants, heat map, statistics (by country, type, status, US state, US grid operator), tour, grid regions; panel extras: rings, compare, share, license countdown, estimates, “Feeds” grid operator
- `data/grid-regions.geojson` – simplified ISO/RTO boundaries for the Grid regions layer (~105 KB, loaded only when the layer is turned on)
- `screenshot*.png` – preview images

Coverage: 300 sites in 40 countries – every power-reactor site in IAEA PRIS (operating, under construction, suspended, shut down), plus 7 never-completed plants (Shoreham, Marble Hill, Phipps Bend in the US; Zwentendorf, Kalkar, Belene, Lungmen elsewhere). Planned-only projects outside the US are not included.

US-only features: license countdown (NRC), “Feeds” grid operator and grid regions (EIA-860 / HIFLD), homes-powered and CO₂ estimates. For non-US plants the panel shows only the generation estimate (net MW × 8,760 h × 90%), and the 10/50-mile rings are drawn at the US NRC distances for scale only.

Data sources (pulled 2026-11-12)

World (non-US) plants
- IAEA PRIS, Power Reactor Information System (https://pris.iaea.org/, via the pris-stats.iaea.org JSON API): every reactor's name, type, model, supplier, net MW, status, construction start, first grid connection, commercial operation, suspension and permanent shutdown dates, and its PRIS site. Reactors are grouped into sites by PRIS site, with a few merges of neighbouring PRIS sites (e.g. Paks + Paks II, Hinkley Point A/B/C, Bruce A/B). Taiwan's reactors (listed by PRIS under China) are shown as Taiwan. Plant status = Operating if any unit is operating, else Suspended operation, else Planned / under construction, else Shut down.
- Coordinates: cross-checked between OpenStreetMap (power=plant, plant:source=nuclear; © OpenStreetMap contributors, ODbL), the English Wikipedia article and GeoNuclearData (https://github.com/cristianst85/GeoNuclearData, ODbL, data 2024-03-03). OSM used for 138 sites, Wikipedia for 67, GeoNuclearData alone for 5.
- GeoNuclearData: also the source for the four non-US never-completed plants.
- English Wikipedia: article link, two-sentence intro and the article's lead image (only if free; checked via page_image_free), with Wikidata P18 as a fallback for a few sites.

US plants
- Wikipedia, "List of commercial nuclear reactors" (United States section): unit type, model, status, net MW, construction start, commercial operation, and closure dates
- U.S. NRC, "List of Power Reactor Units": docket, license number, operator, and location for operating units
- U.S. NRC Information Digest 2024–2025 (NUREG-1350 Vol. 35), Appendix F: license expiration year (data as of Sep 2024)
- Wikipedia plant articles: coordinates, infobox location/operator/owner/cooling source, and the intro text
- Wikidata: fallback coordinates, location, operator, and image
- U.S. EIA, Form EIA-860 Annual Electric Generator Report (https://www.eia.gov/electricity/data/eia860/), Plant file (Schedule 2) "Balancing Authority Code/Name" and NERC region, matched by EIA plant ID to nuclear (NUC) generators. 2025 data for current plants; the 2021, 2019, 2014 and 2013 files for plants that retired before 2025 (Indian Point, Pilgrim, Duane Arnold, Vermont Yankee, Kewaunee). EIA-860 only lists balancing authorities from 2013 on, so plants closed earlier (and never-built or not-yet-filed projects) have no "Feeds" value (`grid: null`). Display names are shortened (e.g. "Midcontinent Independent Transmission System Operator, Inc." → "Midcontinent ISO"; the raw EIA name is kept in `grid.ba_name_eia`); "Duke Energy Florida" is EIA's BA code FPC, listed by EIA as "Progress Energy Florida". Interconnection is derived from the BA (ERCOT → Texas; CAISO, SRP, BPA, PacifiCorp East → Western; all others → Eastern).
- HIFLD "Independent System Operators" boundaries (Oak Ridge National Laboratory; source date June 2020), retrieved from the PASDA mirror (https://www.pasda.psu.edu/uci/DataSummary.aspx?dataset=9103) and simplified with mapshaper (15% Visvalingam, 0.001° precision). Approximate service areas; region counts in the app use each plant's EIA-860 balancing authority, not the polygon it falls in.
- Wikimedia Commons: photos (each one credited, with its license and a link to the Commons file page). Plants with no free photo show an Esri World Imagery satellite view.

Estimates (homes powered, CO₂ avoided; US only) use a 90% capacity factor, 10,500 kWh per home per year and 0.4 kg CO₂/kWh (EIA). NRC emergency planning zones: https://www.nrc.gov/about-nrc/emerg-preparedness/about-emerg-preparedness/planning-zones.html

Not an official product. Status values follow the sources as of the date above.

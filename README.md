# TerraStrike: Geospatial Meteorite Dashboard ☄️🌍

![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![D3.js](https://img.shields.io/badge/d3.js-F9A03C?style=for-the-badge&logo=d3.js&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=Leaflet&logoColor=white)

**TerraStrike** is a highly interactive geospatial data visualization dashboard built to explore historical meteorite landings across the globe. By uniquely combining **Leaflet.js** for interactive map projections and **D3.js** for dynamic, data-driven SVG rendering, this project provides a deep dive into over 1,000 recorded meteorite strikes.

## ✨ Features

- **Interactive SVG Data Overlay**: Meteorites are rendered as scalable D3 vector graphics perfectly overlaid onto a responsive Leaflet CartoDB Voyager basemap.
- **Geospatial Point-in-Polygon Analysis**: Click on any country to calculate real-time regional statistics. The app uses `d3.geoContains` to instantly find all strikes that landed within the complex geometric boundaries of the selected country.
- **Time-Series Filtering**: A dynamic "Year Range" slider dynamically updates the entire dashboard—including map points, total statistics, and bar charts—to only show meteorites that fell within the requested era.
- **Dynamic Sidebar List**: View the top 25 heaviest strikes globally, which instantly updates to reflect only the strikes within a country if one is selected. Click a list item to smoothly fly the map to the exact coordinates.
- **Glassmorphic UI**: Designed with a stunning, modern light-glassmorphic aesthetic featuring frosted glass panels, vibrant accent colors, and custom scrollbars.

## 🛠️ Technology Stack

- **Vanilla JavaScript (ES6+)**: Core logic and event handling.
- **D3.js (v7)**: Used for DOM manipulation, SVG drawing (`d3.geoPath`, `d3.geoTransform`), mathematical calculations (`d3.sum`, `d3.max`), and rendering the animated histogram.
- **Leaflet.js**: Used for the interactive mapping engine, tile rendering, and viewport bounds management.
- **CSS3**: Custom variables, Flexbox layouts, and `backdrop-filter` for glassmorphism effects.

## 📊 Data Sources

This project relies on two primary JSON datasets fetched dynamically at runtime via `Promise.all()`:
1. **Meteorite Landings Dataset**: [NASA / FreeCodeCamp Project Data](https://raw.githubusercontent.com/FreeCodeCamp/ProjectReferenceData/master/meteorite-strike-data.json)
2. **World Country Boundaries (GeoJSON)**: [Johan's GeoJSON Repository](https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json)

## 🚀 Getting Started

Since this project consists entirely of static frontend assets, no complex backend or build tools are required.

### Prerequisites
You just need a basic local web server to bypass CORS restrictions when loading the external JSON files.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/munikumar2003/geospatial_d3_leaflet_dashboard.git
   cd geospatial_d3_leaflet_dashboard
   ```

2. Start a local server. If you have Node.js installed, you can easily use `serve`:
   ```bash
   npx serve .
   ```
   *Alternatively, you can use Python (`python -m http.server`) or the VS Code Live Server extension.*

3. Open your browser and navigate to the provided localhost URL (usually `http://localhost:3000`).

## 💡 Key Learnings & Architecture

This project successfully bridges the gap between Leaflet's tile-based mapping and D3's abstract data rendering. 
- **The Projection Bridge**: Used `map.latLngToLayerPoint` inside a `d3.geoTransform` to ensure D3 SVG elements scale and stick accurately to geographic coordinates when the Leaflet map zooms or pans.
- **Event Management**: Implemented `L.DomEvent.stopPropagation(event)` to manage complex event bubbling between the D3 SVG overlays and the underlying Leaflet interactive panes.
- **Data Binding**: Utilized D3's robust `enter()`, `merge()`, and `exit()` lifecycles to efficiently animate map points in and out of the DOM when users manipulate the year filters.

---
*Designed and built for exploring the cosmos from our own backyard.*

/**
 * ============================================================================
 * TERRASTRIKE: GEOSPATIAL METEORITE DASHBOARD
 * Core Logic (D3.js + Leaflet.js)
 * ============================================================================
 */

// --- 1. DATA SOURCES ---
// The NASA/FreeCodeCamp Meteorite dataset
const meteoritesUrl = 'https://raw.githubusercontent.com/FreeCodeCamp/ProjectReferenceData/master/meteorite-strike-data.json';
// Global Country Boundaries GeoJSON
const countriesUrl = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';

// --- 2. LEAFLET MAP INITIALIZATION ---
// Create the map container, disable the default zoom controls to reposition them, and set starting view to cover the world
const map = L.map('map', { zoomControl: false }).setView([20, 0], 2);
L.control.zoom({ position: 'topright' }).addTo(map);

// Add the CartoDB Voyager Tile Layer (A clean, light-themed map perfect for colorful data overlays)
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Inject an SVG layer into the Leaflet map's overlay pane. D3 will use this SVG to draw elements.
L.svg().addTo(map);
const svg = d3.select('#map').select('svg');

// Create two distinct SVG groups (<g>).
// Leaflet uses 'leaflet-zoom-hide' to temporarily hide these layers during zoom animations for performance.
// We draw countries first so they remain "behind" the meteorite points.
const gCountries = svg.append('g').attr('class', 'leaflet-zoom-hide countries-layer');
const gMeteorites = svg.append('g').attr('class', 'leaflet-zoom-hide meteorites-layer');

// --- 3. UTILITY FUNCTIONS ---
// Determine color based on meteorite mass (kg)
const getColor = (massKg) => {
    if (massKg >= 100) return 'var(--mass-high)'; // Large (Red)
    if (massKg >= 10) return 'var(--mass-med)';   // Medium (Purple)
    return 'var(--mass-low)';                     // Small (Blue)
};

// Calculate SVG circle radius based on mass using a power scale so massive meteorites don't cover the whole map
const getRadius = (massKg) => {
    if (massKg === 0) return 2;
    return Math.max(3, Math.pow(massKg, 0.3) * 1.5);
};

// --- 4. D3/LEAFLET PROJECTION BRIDGE ---
// This is critical: Leaflet handles the map projection (Mercator), but D3 draws the SVG shapes.
// This function takes geographic coordinates (lon, lat) and uses Leaflet's 'latLngToLayerPoint' 
// to convert them into exact X/Y pixel coordinates on our SVG layer.
function projectPoint(x, y) {
    const point = map.latLngToLayerPoint(new L.LatLng(y, x));
    this.stream.point(point.x, point.y);
}
// We wrap our projection function into a D3 geoTransform
const transform = d3.geoTransform({ point: projectPoint });
// And create a D3 path generator that will draw our GeoJSON polygons using those pixel coordinates
const path = d3.geoPath().projection(transform);


// --- 5. DATA FETCHING & PROCESSING ---
// Use Promise.all to fetch both datasets simultaneously for speed.
Promise.all([
    d3.json(countriesUrl),
    d3.json(meteoritesUrl)
]).then(([countriesData, meteoritesData]) => {

    // A. Clean and Prepare Meteorite Data
    let baseFeatures = meteoritesData.features.filter(d =>
        d.properties.mass != null && d.geometry != null &&
        d.geometry.coordinates[0] != null && d.geometry.coordinates[1] != null &&
        d.properties.year != null
    ).map(d => {
        d.massKg = parseFloat(d.properties.mass) / 1000;          // Convert grams to kg
        d.yearNum = parseInt(d.properties.year.substring(0, 4));  // Extract the 4-digit year
        return d;
    });

    // B. Setup the Global Year Filter
    document.getElementById('year-min').value = 1500; // Sensible default minimum year
    const maxYearInDataset = d3.max(baseFeatures, d => d.yearNum);
    document.getElementById('year-max').value = maxYearInDataset;

    // 'currentFeatures' holds the filtered data based on the user's year selection
    let currentFeatures = baseFeatures.filter(d => d.yearNum >= 1500 && d.yearNum <= maxYearInDataset);

    // C. Function to update header statistics
    const updateStats = (data) => {
        d3.select('#total-events').text(data.length.toLocaleString());
        d3.select('#max-mass').text(Math.round(data.length > 0 ? d3.max(data, d => d.massKg) : 0).toLocaleString());
    };
    updateStats(currentFeatures);

    // --- 6. RENDERING LOGIC ---
    
    // Renders the Country Boundaries (Polygons)
    const renderCountries = () => {
        // D3 Data Join
        const countries = gCountries.selectAll('.country-path')
            .data(countriesData.features);

        // Enter phase: Append paths for new countries
        countries.enter().append('path')
            // 'leaflet-interactive' tells Leaflet to allow pointer events (clicks/hovers) on this SVG
            .attr('class', 'country-path leaflet-interactive') 
            .on('click', function (event, d) {
                // VERY IMPORTANT: Stop the click from bubbling down into the Leaflet map (which would trigger our map reset)
                L.DomEvent.stopPropagation(event);

                // Clear previous selections
                gCountries.selectAll('.country-path').classed('selected', false);
                gMeteorites.selectAll('.meteorite-point').classed('selected', false);
                d3.selectAll('.selection-ring').remove();

                // Highlight the clicked country
                d3.select(this).classed('selected', true);

                // D3 Geospatial Analysis: Filter all meteorites to find only those whose coordinates fall inside this country polygon
                const meteorsInCountry = currentFeatures.filter(m => d3.geoContains(d, m.geometry.coordinates));

                // Update Sidebars
                showCountryDetails(d.properties.name, meteorsInCountry);
                buildEventList(meteorsInCountry, d.properties.name);

                // Use Leaflet to automatically animate and zoom the map to fit the clicked country's boundaries
                const bounds = d3.geoBounds(d);
                map.fitBounds([
                    [bounds[0][1], bounds[0][0]], // SouthWest
                    [bounds[1][1], bounds[1][0]]  // NorthEast
                ], { padding: [50, 50], animate: true, duration: 1.5 });
            })
            // Merge phase: Update the 'd' attribute (the actual drawing instructions) for all paths using our projection
            .merge(countries)
            .attr('d', path);
    };

    // Renders the Meteorite Strikes (Circles)
    const renderMeteorites = () => {
        // Bind the currently filtered dataset using the unique meteorite ID
        const points = gMeteorites.selectAll('circle.meteorite-point')
            .data(currentFeatures, d => d.properties.id);

        // Create new circles for new data points
        const pointsEnter = points.enter().append('circle')
            .attr('class', 'meteorite-point leaflet-interactive')
            .attr('fill', d => getColor(d.massKg))
            .attr('fill-opacity', 0.5)
            .attr('stroke', d => getColor(d.massKg))
            .attr('stroke-width', 0.5)
            .on('click', function (event, d) {
                // Prevent map reset
                L.DomEvent.stopPropagation(event);

                // Reset map UI states
                gCountries.selectAll('.country-path').classed('selected', false);
                gMeteorites.selectAll('.meteorite-point').classed('selected', false);
                d3.selectAll('.selection-ring').remove();

                // Highlight clicked meteorite
                d3.select(this).classed('selected', true);

                // Create a pulsing animation ring around the selected point
                gMeteorites.append('circle')
                    .attr('class', 'selection-ring')
                    .attr('cx', d3.select(this).attr('cx'))
                    .attr('cy', d3.select(this).attr('cy'))
                    .attr('fill', 'none')
                    .attr('stroke', getColor(d.massKg))
                    .attr('stroke-width', 2)
                    .call(animateRing, getRadius(d.massKg));

                // Update left panel
                showMeteoriteDetails(d);
            });

        // Update phase: Re-calculate positions and radii for all points
        // We use Leaflet's latLngToLayerPoint to place the circles correctly on the zoom level
        pointsEnter.merge(points)
            .attr('r', d => getRadius(d.massKg))
            .attr('cx', d => map.latLngToLayerPoint([d.geometry.coordinates[1], d.geometry.coordinates[0]]).x)
            .attr('cy', d => map.latLngToLayerPoint([d.geometry.coordinates[1], d.geometry.coordinates[0]]).y);

        // Exit phase: Remove meteorites that were filtered out
        points.exit().remove();

        // Ensure the selection ring (if active) sticks to the meteorite during a map zoom
        gMeteorites.selectAll('.selection-ring')
            .attr('cx', () => {
                const selected = gMeteorites.select('.meteorite-point.selected');
                return selected.empty() ? 0 : selected.attr('cx');
            })
            .attr('cy', () => {
                const selected = gMeteorites.select('.meteorite-point.selected');
                return selected.empty() ? 0 : selected.attr('cy');
            });
    };

    // Recursive D3 animation function to make the selection ring continuously pulse
    function animateRing(selection, baseRadius) {
        selection.attr('r', baseRadius + 4)
            .attr('stroke-opacity', 1)
            .transition().duration(1500)
            .attr('r', baseRadius + 15)
            .attr('stroke-opacity', 0)
            .on('end', function () { d3.select(this).call(animateRing, baseRadius); });
    }

    // --- 7. SYNCING D3 WITH LEAFLET ---
    // Every time the map is moved or zoomed, Leaflet updates its projection.
    // We must re-render the SVG paths and circles so they stay pinned to the correct geographic locations.
    const updateMap = () => {
        renderCountries();
        renderMeteorites();
    };

    updateMap();
    map.on('viewreset zoom moveend', updateMap);

    // Initial Sidebar Renders
    buildBarChart(currentFeatures);
    buildEventList(currentFeatures);

    // Global reset: Clicking on the empty ocean clears all selections
    map.on('click', function () {
        gCountries.selectAll('.country-path').classed('selected', false);
        gMeteorites.selectAll('.meteorite-point').classed('selected', false);
        d3.selectAll('.selection-ring').remove();

        document.getElementById('selection-content').innerHTML = `
            <div class="empty-state">
                <div class="icon-emoji">👆</div>
                <p>Tap any country or meteorite on the map to explore its data.</p>
            </div>
        `;
        buildEventList(currentFeatures);
    });

    // --- 8. YEAR FILTERING LOGIC ---
    // When the user changes the "Year Range" inputs, this function filters the dataset and triggers a global re-render
    const handleFilterChange = () => {
        const yMin = parseInt(document.getElementById('year-min').value) || 0;
        const yMax = parseInt(document.getElementById('year-max').value) || new Date().getFullYear();

        // 1. Update our state
        currentFeatures = baseFeatures.filter(d => d.yearNum >= yMin && d.yearNum <= yMax);

        // 2. Update Map and Header Stats
        updateStats(currentFeatures);
        renderMeteorites();

        // 3. Rebuild the Bar Chart
        document.getElementById('bar-chart').innerHTML = '';
        buildBarChart(currentFeatures);

        // 4. Reset map interactivity state and rebuild the list
        gCountries.selectAll('.country-path').classed('selected', false);
        d3.selectAll('.selection-ring').remove();
        document.getElementById('selection-content').innerHTML = `
            <div class="empty-state">
                <div class="icon-emoji">👆</div>
                <p>Tap any country or meteorite on the map to explore its data.</p>
            </div>
        `;
        buildEventList(currentFeatures);
    };

    // Attach event listeners to inputs
    document.getElementById('year-min').addEventListener('change', handleFilterChange);
    document.getElementById('year-max').addEventListener('change', handleFilterChange);

}).catch(err => console.error("Error loading data:", err));


// ============================================================================
// UI PANEL RENDERING LOGIC
// ============================================================================

// Updates the left panel when a country is clicked
function showCountryDetails(countryName, meteorites) {
    const totalMass = d3.sum(meteorites, d => d.massKg);
    const maxMass = meteorites.length > 0 ? d3.max(meteorites, d => d.massKg) : 0;

    document.getElementById('selection-content').innerHTML = `
        <div class="detail-card">
            <h3>🌍 ${countryName}</h3>
            <div class="detail-stat"><span>Recorded Strikes:</span> <strong>${meteorites.length.toLocaleString()}</strong></div>
            <div class="detail-stat"><span>Total Mass:</span> <strong>${totalMass.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</strong></div>
            <div class="detail-stat"><span>Largest Strike:</span> <strong>${maxMass.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</strong></div>
            ${meteorites.length === 0 ? '<p style="margin-top:1rem; font-size:0.85rem; color:var(--text-secondary);">No recorded strikes in this region from this dataset.</p>' : ''}
        </div>
    `;
}

// Updates the left panel when a single meteorite is clicked
function showMeteoriteDetails(d) {
    const year = d.properties.year ? d.properties.year.substring(0, 4) : 'Unknown';
    document.getElementById('selection-content').innerHTML = `
        <div class="detail-card">
            <h3>☄️ ${d.properties.name}</h3>
            <div class="detail-stat"><span>Mass:</span> <strong style="color: ${getColor(d.massKg)}">${d.massKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</strong></div>
            <div class="detail-stat"><span>Class:</span> <strong>${d.properties.recclass}</strong></div>
            <div class="detail-stat"><span>Fall Status:</span> <strong>${d.properties.fall}</strong></div>
            <div class="detail-stat"><span>Year:</span> <strong>${year}</strong></div>
            <div class="detail-stat" style="font-size: 0.8rem; margin-top: 0.5rem;"><span>Coordinates:</span> <strong>${d.geometry.coordinates[1].toFixed(2)}, ${d.geometry.coordinates[0].toFixed(2)}</strong></div>
        </div>
    `;
}

// Builds the animated histogram chart showing mass distribution
function buildBarChart(features) {
    const container = d3.select('#bar-chart');
    const width = container.node().getBoundingClientRect().width;
    const height = 200;
    const margin = { top: 20, right: 10, bottom: 30, left: 40 };

    // Group the data into three mass categories
    const bins = [
        { label: '< 10', min: 0, max: 10, color: '#38bdf8' },
        { label: '10-100', min: 10, max: 100, color: '#a855f7' },
        { label: '> 100', min: 100, max: Infinity, color: '#f43f5e' }
    ];

    const data = bins.map(b => ({
        label: b.label, color: b.color,
        count: features.filter(d => d.massKg >= b.min && d.massKg < b.max).length
    }));

    // Create D3 Scales
    const svg = container.append('svg').attr('width', width).attr('height', height);
    const x = d3.scaleBand().domain(data.map(d => d.label)).range([margin.left, width - margin.right]).padding(0.4);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count)]).range([height - margin.bottom, margin.top]);

    // Draw Axes
    svg.append('g').attr('class', 'axis x-axis').attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickSizeOuter(0));

    svg.append('g').attr('class', 'axis y-axis').attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(".0s")));

    // Draw Bars
    svg.selectAll('.bar').data(data).enter().append('rect').attr('class', 'bar')
        .attr('x', d => x(d.label)).attr('width', x.bandwidth()).attr('y', d => y(d.count))
        .attr('height', d => height - margin.bottom - y(d.count)).attr('fill', d => d.color).attr('rx', 4);
}

// Builds the Top 25 list of meteorites on the right sidebar
function buildEventList(eventFeatures, countryName = null) {
    const titleElem = document.querySelector('.list-panel h2');
    if (titleElem) {
        titleElem.textContent = countryName ? `Strikes: ${countryName}` : `Heaviest Strikes (Global)`;
    }

    // Sort by mass descending and take top 25
    const top = [...eventFeatures].sort((a, b) => b.massKg - a.massKg).slice(0, 25);
    const list = d3.select('#event-list');
    
    list.html(''); // Clear previous list

    if (top.length === 0) {
        list.append('li')
            .style('padding', '1rem')
            .style('text-align', 'center')
            .style('color', 'var(--text-secondary)')
            .text('No meteorites recorded here.');
        return;
    }

    // Data Bind & Enter
    const items = list.selectAll('.event-item').data(top).enter().append('li')
        .attr('class', d => `event-item ${d.massKg >= 100 ? 'high' : (d.massKg >= 10 ? 'med' : 'low')}`)
        .style('opacity', 0)
        .style('transform', 'translateY(10px)')
        .on('click', (event, d) => {
            // When a list item is clicked, fly the Leaflet map to that coordinate
            L.DomEvent.stopPropagation(event);
            map.flyTo([d.geometry.coordinates[1], d.geometry.coordinates[0]], 8, { animate: true });

            // Find the corresponding map point and apply the selection ring
            d3.selectAll('.meteorite-point').classed('selected', false);
            d3.selectAll('.selection-ring').remove();

            const selectedNode = d3.selectAll('.meteorite-point').filter(p => p.properties.id === d.properties.id).node();
            if (selectedNode) {
                d3.select(selectedNode).classed('selected', true);
                d3.select('.meteorites-layer').append('circle')
                    .attr('class', 'selection-ring')
                    .attr('cx', d3.select(selectedNode).attr('cx'))
                    .attr('cy', d3.select(selectedNode).attr('cy'))
                    .attr('fill', 'none')
                    .attr('stroke', getColor(d.massKg))
                    .attr('stroke-width', 2)
                    .call(animateRing, Math.max(3, Math.pow(d.massKg, 0.3) * 1.5));
            }

            showMeteoriteDetails(d);
        });

    items.append('div').attr('class', 'event-title').text(d => d.properties.name);
    const meta = items.append('div').attr('class', 'event-meta');
    meta.append('span').attr('class', 'event-mass').text(d => `${Math.round(d.massKg).toLocaleString()} kg`);
    meta.append('span').text(d => d.properties.year ? d.properties.year.substring(0, 4) : '');

    // Staggered entry animation for the list items
    items.transition()
        .duration(400)
        .delay((d, i) => i * 30)
        .style('opacity', 1)
        .style('transform', 'translateY(0)');
}

function animateRing(selection, baseRadius) {
    selection.attr('r', baseRadius + 4)
        .attr('stroke-opacity', 1)
        .transition().duration(1500)
        .attr('r', baseRadius + 15)
        .attr('stroke-opacity', 0)
        .on('end', function () { d3.select(this).call(animateRing, baseRadius); });
}

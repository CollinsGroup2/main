// Load the world borders onto Leaflet as a GeoJSON layer
// Each layer is stored in the borders object.
function loadBorders() {
    fetch("assets/border.json")
        .then((response) => response.json())
        .then((json) => {
            const layer = L.geoJson(json, {
                style: function(feature) {
                    return {
                        color: "#0099FF",
                        fill: false
                    }
                },
                onEachFeature: function(feature, layer) {
                    const key = feature.properties.ISO2;
                    borders[key] = layer;
                }
            });
        });
}

// Calculate the area of a country
function getCountryArea(code) {
    const border = borders[code];
    const ll = border.getLatLngs();
    let area = 0;
    // Countries may be comprised of multiple polygons
    for (let island of ll) {
        if (island.length < 2) {
            island = island[0];
        }

        // Add up the total area of every polygon
        area += L.GeometryUtil.geodesicArea(island);
    }
    return area;
}

function dropdown() {
    document.getElementById("myDropdown").classList.toggle("show"); 
}
let map = null;

// Initialise the map
function initLeaflet() {
    map = L.map("map");
    map.setView([54, -4], 5);

    const tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
    tileLayer.addTo(map);
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });
    satelliteLayer.addTo(map);

    const tileLayers = {
        "Street": tileLayer,
        "Satellite": satelliteLayer
    };

    const layerControl = L.control.layers(tileLayers, {});
    layerControl.addTo(map);
}

function getPoints() {
    fetch("points.php")
        .then((response) => response.text())
        .then((text) => {
            const coords = text.split(",");
            for (let i = 0; i < coords.length; i += 2) {
                const long = parseFloat(coords[i]);
                const lat = parseFloat(coords[i + 1]);

                const marker = L.marker([long, lat]);
                marker.addTo(map);
            }
        });
}

// Wait until the browser has loaded everything before we start initialising things.
window.onload = function() {
    initLeaflet();
    getPoints();
}
// Initialise the map
function initLeaflet() {
    const map = L.map("map");
    map.setView([54, -4], 5);

    const tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
    tileLayer.addTo(map);
}

// Wait until the browser has loaded everything before we start initialising things.
window.onload = function() {
    initLeaflet();
}
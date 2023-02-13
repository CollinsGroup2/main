let map = null;

// Initialise the map
function initLeaflet() {
    map = L.map("map");
    map.setView([54, -4], 5);

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });
    satelliteLayer.addTo(map);
    const tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    const tileLayers = {
        "Satellite": satelliteLayer,
        "Street": tileLayer
    };

    const layerControl = L.control.layers(tileLayers, {});
    layerControl.addTo(map);

    L.control.scale().addTo(map);
}

function getCoords(string) {
    const split = string.split(",");
    return [ split[0], split[1] ];
}

function swapCoords(list) {
    let out = [];
    for (let i = 0; i < list.length; i++) {
        out.push([ list[i][1], list[i][0] ]);
    }
    return out;
}
function getPoints() {
    fetch("headers.php")
        .then((response) => response.json())
        .then((json) => {
            for (let i = 0; i < json.length; i += 2) {
                const mission = json[i];

                const id = mission[0];
                const coords = getCoords(mission[1]);
                const creationDate = mission[2];
                const modifiedDate = mission[3];
                const type = mission[4];
                let polygonCoords = mission[5];

                const icon = L.icon({
                    iconUrl: "assets/Mission.svg",
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });

                let markerText = "";
                markerText += `<strong>ID:</strong> <code>${id}</code><br/>`;
                markerText += `<strong>Co-ordinates:</strong> ${coords[0]}, ${coords[1]}<br/>`;
                markerText += `<strong>Created:</strong> ${creationDate}<br/>`;
                markerText += `<strong>Modified:</strong> ${modifiedDate}<br/>`;
                markerText += `<strong>Type:</strong> ${type}<br/>`;

                const marker = L.marker(coords, {icon:icon});
                marker.bindPopup(markerText);
                marker.addTo(map);

                if (type === "Polygon") {
                    for (let j = 0; j < polygonCoords.length; j++) {
                        const shapeCoords = swapCoords(polygonCoords[j]);
                        const polygon = L.polygon(shapeCoords, { color: "red" });
                        polygon.addTo(map);
                    }
                } else if (type === "LineString") {
                    const shapeCoords = swapCoords(polygonCoords);
                    const line = L.polyline(shapeCoords, { color: "red" });
                    line.addTo(map);
                }
            }
        });
}

// Wait until the browser has loaded everything before we start initialising things.
window.onload = function() {
    initLeaflet();
    getPoints();
}
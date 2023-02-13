let map = null;
let shapesGroup = null;
const dateFormat = Intl.DateTimeFormat("en-GB", {
    "dateStyle": "long",
    "timeStyle": "long"
});

// Initialise the map
function initLeaflet() {
    map = L.map("map");
    map.setView([54, -4], 5);
    map.on("popupopen", popupOpen);
    map.on("popupclose", popupClose);

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });
    satelliteLayer.addTo(map);
    const tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    shapesGroup = L.layerGroup([]);

    const tileLayers = {
        "Satellite": satelliteLayer,
        "Street": tileLayer
    };

    const overlays = {
        "Shapes": shapesGroup
    };

    const layerControl = L.control.layers(tileLayers, overlays);
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
                const creationDate = new Date(mission[2]);
                const modifiedDate = new Date(mission[3]);
                const shapeType = mission[4];
                const polygonCoords = mission[5];
                const type = mission[6];

                let icon;

                if (type === "IMAGERY") {
                    icon = L.icon({
                        iconUrl: "assets/Imagery.svg",
                        iconSize: [32, 32],
                        iconAnchor: [16, 16]
                    });
                } else if (type === "SCENE") {
                    icon = L.icon({
                        iconUrl: "assets/Mission.svg",
                        iconSize: [32, 24],
                        iconAnchor: [16, 12]
                    });
                }

                let markerText = "";
                markerText += `<strong>ID:</strong> <code>${id}</code><br/>`;
                markerText += `<strong>Type:</strong> <code>${type}</code><br/>`;
                markerText += `<strong>Centre:</strong> ${coords[0]}, ${coords[1]}<br/>`;
                markerText += `<strong>Created:</strong> ${dateFormat.format(creationDate)}<br/>`;
                markerText += `<strong>Modified:</strong> ${dateFormat.format(modifiedDate)}<br/>`;
                markerText += `<strong>Shape:</strong> ${shapeType}<br/>`;

                const marker = L.marker(coords, {icon:icon});
                marker.shapes = [];
                marker.bindPopup(markerText);
                marker.getPopup().marker = marker;
                marker.addTo(map);

                if (shapeType === "Polygon") {
                    for (let j = 0; j < polygonCoords.length; j++) {
                        const shapeCoords = swapCoords(polygonCoords[j]);
                        console.debug(`${i} has ${shapeCoords.length} coords`);
                        const polygon = L.polygon(shapeCoords, { color: "red" });
                        shapesGroup.addLayer(polygon);
                        marker.shapes.push(polygon);
                    }
                } else if (shapeType === "LineString") {
                    const shapeCoords = swapCoords(polygonCoords);
                    const line = L.polyline(shapeCoords, { color: "red" });
                    shapesGroup.addLayer(line);
                    marker.shapes.push(line);
                }
            }
        });
}

function popupOpen(e) {
    const marker = e.popup.marker;
    const shapes = marker.shapes;

    shapes.forEach((shape) => {
        shape.addTo(map);
    });
}

function popupClose(e) {
    const marker = e.popup.marker;
    const shapes = marker.shapes;

    shapes.forEach((shape) => {
        shape.remove();
    });
}

// Wait until the browser has loaded everything before we start initialising things.
window.onload = function() {
    initLeaflet();
    getPoints();
}
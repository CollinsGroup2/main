let map = null;
let shapesGroup = null;
const dateFormat = Intl.DateTimeFormat("en-GB", {
    "dateStyle": "long",
    "timeStyle": "long"
});
const borders = {};
const products = [];

// Initialise the map
function initLeaflet() {
    map = L.map("map");
    map.setView([54, -4], 5);
    map.on("popupopen", popupOpen);
    map.on("popupclose", popupClose);

    // Create the satellite and street layers.
    // Only the satellite layer is added to the map to make it the default.
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });
    satelliteLayer.addTo(map);
    const tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    shapesGroup = L.layerGroup([]);

    // Set up the layer selection control
    const tileLayers = {
        "Satellite": satelliteLayer,
        "Street": tileLayer
    };

    const overlays = {
        "Shapes": shapesGroup
    };

    const layerControl = L.control.layers(tileLayers, overlays);
    layerControl.addTo(map);

    // Add the scale control
    L.control.scale().addTo(map);

    // Load the country border data
    loadBorders();
}

// Extract coordinates from a "12.345,67.890" string
function getCoords(string) {
    const split = string.split(",");
    return [ split[0], split[1] ];
}

// Swap each component in each coordinate in a list of coordinates.
function swapCoords(list) {
    let out = [];
    for (let i = 0; i < list.length; i++) {
        out.push([ list[i][1], list[i][0] ]);
    }
    return out;
}

// The big function that gets the data from the backend and adds it to the map
function getPoints(pgId) {
    let url = "headers.php?";
    if (pgId) {
        url += new URLSearchParams({
            "page": pgId
        });
    }

    fetch(url)
        .then((response) => response.json())
        .then((json) => {
            let totalArea = 0;

            const missions = json["missions"];
            if (missions.length === 0) {
                onProductsLoaded();
                return;
            }

            for (let i = 0; i < missions.length; i += 2) {
                const mission = missions[i];

                const id = mission[0];
                const coords = getCoords(mission[1]);
                const creationDate = new Date(mission[2]);
                const modifiedDate = new Date(mission[3]);
                const shapeType = mission[4];
                const polygonCoords = mission[5];
                const type = mission[6];

                // Determine icon
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

                // Popup text
                let markerText = "";
                markerText += `<strong>ID:</strong> <code>${id}</code><br/>`;
                markerText += `<strong>Type:</strong> <code>${type}</code><br/>`;
                markerText += `<strong>Centre:</strong> ${coords[0]}, ${coords[1]}<br/>`;
                markerText += `<strong>Created:</strong> ${dateFormat.format(creationDate)}<br/>`;
                markerText += `<strong>Modified:</strong> ${dateFormat.format(modifiedDate)}<br/>`;
                markerText += `<strong>Shape:</strong> ${shapeType}<br/>`;

                // The marker itself
                const marker = L.marker(coords, {icon:icon});
                marker.shapes = [];
                marker.shapeType = shapeType;
                marker.bindPopup(markerText);
                marker.getPopup().marker = marker;
                marker.addTo(map);

                // Products can have multiple polygons although none in our dataset do
                if (shapeType === "Polygon") {
                    for (let j = 0; j < polygonCoords.length; j++) {
                        const shapeCoords = swapCoords(polygonCoords[j]);
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

                products.push(marker);
            }

            getPoints(json["paginationID"]);
        });
}

// Called by getPoints when there are no more pages
function onProductsLoaded() {
    let totalArea = 0;

    for (const product of products) {
        if (product.shapeType !== "Polygon") {
            continue;
        }

        for (const shape of product.shapes) {
            const latlngs = shape.getLatLngs();
            for (const island of latlngs) {
                totalArea += L.GeometryUtil.geodesicArea(island);
            }
        }
    }

    console.info("Total area: " + L.GeometryUtil.readableArea(totalArea, true, 3));
    const ukArea = getCountryArea("GB");
    console.info("UK area: " + L.GeometryUtil.readableArea(ukArea, true, 3));
    const coveragePct = totalArea / ukArea * 100.0;
    console.info("Coverage: " + coveragePct + "%");
}

// Callbacks that add and remove the shape of a product when the popup is opened or close.
function popupOpen(e) {
    const marker = e.popup.marker;
    if (!marker) return;
    const shapes = marker.shapes;

    shapes.forEach((shape) => {
        shape.addTo(map);
    });
}

function popupClose(e) {
    const marker = e.popup.marker;
    if (!marker) return;
    const shapes = marker.shapes;

    shapes.forEach((shape) => {
        shape.remove();
    });
}

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
            layer.addTo(map);
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

        area += L.GeometryUtil.geodesicArea(island);
    }
    return area;
}

// Wait until the browser has loaded everything before we start initialising things.
window.onload = function() {
    initLeaflet();
    getPoints();
}
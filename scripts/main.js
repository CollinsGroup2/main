let map = null;
let shapesGroup = null;
const dateFormat = Intl.DateTimeFormat("en-GB", {
    "dateStyle": "long",
    "timeStyle": "long"
});
const borders = {};
const products = [];
let layerControl = null;
let heatMap = null, heatMapGroup = null;
let satelliteLayer, tileLayer;

// Initialise the map
function initLeaflet() {
    map = L.map("map");
    map.setView([54, -4], 5);
    map.on("popupopen", popupOpen);
    map.on("popupclose", popupClose);

    // Create the satellite and street layers.
    // Only the satellite layer is added to the map to make it the default.
    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });
    satelliteLayer.addTo(map);
    tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    shapesGroup = L.layerGroup([]);
    heatMapGroup = L.layerGroup([]);

    updateLayerControl();

    // Add the scale control
    L.control.scale().addTo(map);

    // Load the country border data
    loadBorders();
}

function updateLayerControl() {
    if (layerControl !== null) {
        layerControl.remove();
        layerControl = null;
    }

    // Set up the layer selection control
    const tileLayers = {
        "Satellite": satelliteLayer,
        "Street": tileLayer
    };

    const overlays = {
        "Footprints": shapesGroup,
        "Heatmap": heatMapGroup
    };

    layerControl = L.control.layers(tileLayers, overlays);
    layerControl.addTo(map);
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
    let url = "backend/get_products.php?";
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

            for (let i = 0; i < missions.length; i ++) {
                const mission = missions[i];

                const id = mission[0];
                const coords = getCoords(mission[1]);
                const creationDate = new Date(mission[2]);
                const modifiedDate = new Date(mission[3]);
                const footprint = mission[4];
                const type = mission[5];
                const policy = mission[6];

                // Determine icon
                let icon;

                if (type === "IMAGERY") {
                    icon = L.icon({
                        iconUrl: "scripts/img/Imagery.png",
                        iconSize: [32, 32],
                        iconAnchor: [16, 16]
                    });
                } else if (type === "SCENE") {
                    icon = L.icon({
                        iconUrl: "scripts/img/plane.png",
                        iconSize: [32, 21],
                        iconAnchor: [16, 11]
                    });
                }

                // Popup text
                let markerText = "";
                markerText += `<strong>ID:</strong> <code>${id}</code><br/>`;
                markerText += `<strong>Type:</strong> <code>${type}</code><br/>`;
                markerText += `<strong>Centre:</strong> ${coords[0]}, ${coords[1]}<br/>`;
                markerText += `<strong>Created:</strong> ${dateFormat.format(creationDate)}<br/>`;
                markerText += `<strong>Modified:</strong> ${dateFormat.format(modifiedDate)}<br/>`;
                markerText += `<strong>Policy:</strong> ${policy}`;

                // The marker itself
                const marker = L.marker(coords, {icon:icon});
                marker.productId = id;
                marker.bindPopup(markerText);
                marker.getPopup().marker = marker;
                marker.addTo(map);

                const layer = L.GeoJSON.geometryToLayer(footprint, {
                    "color": "red"
                });
                shapesGroup.addLayer(layer);
                marker.footprint = layer;

                products.push(marker);
            }

            if (json["paginationID"]) {
                getPoints(json["paginationID"]);
            } else {
                onProductsLoaded();
            }
        });
}

// Called by getPoints when there are no more pages
function onProductsLoaded() {
    updateProductsList();
    createHeatmap();
}

function createHeatmap() {
    const data = {
        min: 0,
        data: []
    };

    const options = {
        "radius": 1.5,
        "scaleRadius": true,
        "useLocalExtrema": false,
        "maxOpacity": 0.75,
        "latField": "lat",
        "lngField": "lng",
        "valueField": "count"
    }

    // The heatmap needs multiple points at the exact same co-ordinate to work properly
    // So we round each co-ordinate.
    // This makes it somewhat ugly and grid-like, but it's better than a sea of blue.

    let flat = {};
    let max = 0;

    for (const product of products) {
        const ll = product.getLatLng();
        const key = Math.round(ll.lat) + ":" + Math.round(ll.lng);

        if (flat.hasOwnProperty(key)) {
            flat[key]++;
        } else {
            flat[key] = 1;
        }

        max = Math.max(max, flat[key]);
    }

    data.max = max;
    for (const key in flat) {
        const split = key.split(":");
        const lat = parseFloat(split[0]);
        const lng = parseFloat(split[1]);
        const count = flat[key];

        data.data.push({
            "lat": lat, "lng": lng, "count": count
        });
    }

    heatMap = new HeatmapOverlay(options);
    heatMap.setData(data);
    heatMapGroup.addLayer(heatMap);
}

// Callbacks that add and remove the shape of a product when the popup is opened or close.
function popupOpen(e) {
    const marker = e.popup.marker;
    if (!marker) return;
    const shape = marker.footprint;
    shape.addTo(map);
}

function popupClose(e) {
    const marker = e.popup.marker;
    if (!marker) return;
    const shape = marker.footprint;

    // Only remove the shapes if the shapes layer is disabled
    if (!map.hasLayer(shapesGroup)) {
        shape.remove();
    }
}

// Callback for the product links in the sidebar
function productLinkClick() {
    const id = this.innerText;
    const marker = getMarkerById(id);
    const latlng = marker.getLatLng();
    map.flyTo(latlng, 12);
    marker.openPopup();
}

// Updates the product list in the sidebar
function updateProductsList() {
    const list = document.getElementById("products");
    list.innerHTML = "";

    for (const product of products) {
        const element = document.createElement("li");
        const link = document.createElement("a");
        link.innerText = product.productId;
        link.setAttribute("href", "javascript:;");
        link.onclick = productLinkClick;
        element.appendChild(link);
        list.appendChild(element);
    }
}

function getMarkerById(id) {
    for (const marker of products) {
        if (marker.productId === id) {
            return marker;
        }
    }
    return marker;
}

// Wait until the browser has loaded everything before we start initialising things.
window.onload = function() {
    initLeaflet();
    getPoints();
}
// The leaflet map itself
let map = null;
// Shapes/footprint group - for the layers control
let shapesGroup = null;
// Date formatter
const dateFormat = Intl.DateTimeFormat("en-GB", {
    "dateStyle": "long",
    "timeStyle": "long"
});
// A map of two-character country codes to the Leaflet layer representing the border for that country
const borders = {};
// List of markers representing products
const products = [];
/// The layer selection box in the top-right
let layerControl = null;
// The heat map layer
let heatMap = null;
// The heat map layer group.
// The heatmap layer is created after products are loaded, but this always exists, allowing the heatmap to be enabled when products are still loading
let heatMapGroup = null;
// Satellite layer
let satelliteLayer;
// Street layer
let tileLayer;
let selectedRectangles;

// Initialise the map
function initLeaflet() {
    map = L.map("map");
    map.setView([54, -4], 5);
    map.on("popupopen", popupOpen);
    map.on("popupclose", popupClose);

    // Create the satellite and street layers.
    // Only the satellite layer is added to the map to make it the default.
    // Street layer is selectable from the layers control.
    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });
    satelliteLayer.addTo(map);
    // Create street layer
    tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    shapesGroup = L.layerGroup([]);
    heatMapGroup = L.layerGroup([]);
    selectedRectangles = L.layerGroup([]).addTo(map);

    updateLayerControl();

    // Add the scale control
    L.control.scale().addTo(map);

    // Load the country border data
    loadBorders();

    // Add geocoder for the search bar
    L.Control.geocoder().addTo(map);
    document.getElementById("map").style.width ="calc(100% - 250px)";

    map.on("boxzoomend", onShiftDrag);
}

// Update the layers controls
function updateLayerControl() {
    // Remove the layer control if one already exists
    if (layerControl !== null) {
        layerControl.remove();
        layerControl = null;
    }

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
    // Pagination
    if (pgId) {
        url += new URLSearchParams({
            "page": pgId
        });
    }

    fetch(url)
        .then((response) => response.json())
        .then((json) => {
            const missions = json["missions"];
            // If there are no more missions, we're at the end of the list
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
                markerText += `<strong>Policy:</strong> ${policy}`;

                // The marker itself
                const marker = L.marker(coords, {icon:icon});
                marker.productId = id;
                marker.bindPopup(markerText);
                marker.getPopup().marker = marker;
                marker.addTo(map);

                // Craete the footprint layer from the GeoJSON
                const layer = L.GeoJSON.geometryToLayer(footprint, {
                    "color": 'orange'
                });
                shapesGroup.addLayer(layer);
                marker.footprint = layer;

                // add it to the list
                products.push(marker);
            }

            // If there's another page, fetch it
            if (json["paginationID"]) {
                getPoints(json["paginationID"]);
            }
            // otherwise, we're at the end
            else {
                onProductsLoaded();
            }
        });
}

// Called by getPoints when there are no more pages
function onProductsLoaded() {
    updateProductsList();
    createHeatmap();
}

// Craetes the heatmap data
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
        // Get the co-ords and round them
        const ll = product.getLatLng();
        const key = Math.round(ll.lat) + ":" + Math.round(ll.lng);

        // Increase the number of products at those rounded coordinates by one
        if (flat.hasOwnProperty(key)) {
            flat[key]++;
        } else {
            flat[key] = 1;
        }

        // Figure out what the highest amount of products are at any given point.
        max = Math.max(max, flat[key]);
    }

    data.max = max;

    // Now push that processed data into the array that the heatmap plugin expects
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
    // Get the marker, bail if we clicked on nothing
    const marker = e.popup.marker;
    if (!marker) return;

    // Show the footprint
    const shape = marker.footprint;
    shape.addTo(map);
}

function popupClose(e) {
    // Get the marker, bail if we clicked on nothing
    const marker = e.popup.marker;
    if (!marker) return;
    const shape = marker.footprint;

    // Only remove the shapes if the shapes layer is disabled
    if (!map.hasLayer(shapesGroup)) {
        shape.remove();
    }
}

// Callback for the product links in the sidebar
function productLinkClick(id) {
    const marker = getMarkerById(id);
    const latlng = marker.getLatLng();
    map.flyTo(latlng, 12);
    marker.openPopup();
}

// Updates the product list in the sidebar
function updateProductsList(productList) {
    productList = productList || products;
    const list = document.getElementById("sidenav-product-container");
    list.innerHTML = "";
    var count = 0;

    for (const product of productList) {
        //Creates elements based on template

        /*
        <div class="sidenav-product">
            <div class="sidenav-item">
              <a href="#">Product #1</a>
              <a href="report_page.html">&#128196;</a>
            </div>
            <ul id="products"><ul>
          </div>
        */
        count++;
        const div = document.createElement("div");
        const innerDiv = document.createElement("div");
        const link = document.createElement("a");
        const iconLink = document.createElement("a");
        const ul = document.createElement("ul");

        div.className = "sidenav-product";
        innerDiv.className = "sidenav-item";

        link.innerText = "Product #" + count;
        link.setAttribute("href", "javascript:;");
        link.onclick = () => { productLinkClick(product.productId); };
        iconLink.setAttribute("href", "report_page.html");
        iconLink.innerHTML = '&#128196;';
        ul.id = "products";
        ul.innerHTML = product.productId;

        div.appendChild(innerDiv);
        innerDiv.appendChild(link);
        innerDiv.appendChild(iconLink);
        innerDiv.appendChild(ul);
        div.appendChild(ul);
        list.appendChild(div);
    }
}

// Gets a product's marker by its ID
function getMarkerById(id) {
    for (const marker of products) {
        if (marker.productId === id) {
            return marker;
        }
    }
    return null;
}

function onShiftDrag(e) {
    selectedRectangles.clearLayers();
    var rectangle;
    var bounds = [[e.boxZoomBounds._northEast.lat, e.boxZoomBounds._northEast.lng], // gets the bounds/corners of the box drawn
        [e.boxZoomBounds._southWest.lat, e.boxZoomBounds._southWest.lng]];

    var rectangle = L.rectangle(bounds,{ // creates a rectangle that stays after the drag
        fillColor: 'orange',
        color: 'orange'
    }).addTo(selectedRectangles);
    let arr = []; // declare an array to be populated with markers.
    //can be put into its own function
    for (const element of products) { // forloop that iterates through all markers to see if they are in the rectangle
        if (rectangle.contains(element.getLatLng())) {
            arr.push(element);
        }
    }
    updateProductsList(arr);
}

// Wait until the browser has loaded everything before we start initialising things.
window.onload = function() {
    initLeaflet();
    getPoints();
}
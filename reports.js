// Map of products by their ID
let products = {};
// Product we are currently viewing a report for
let currentProduct = null;
// Date formatter
const dateFormat = Intl.DateTimeFormat("en-GB", {
    "dateStyle": "long",
    "timeStyle": "long"
});
// A map of two-character country codes to the Leaflet layer representing the border for that country
const borders = {};
// The chart.js chart
let chart = null;

// Earliest and latest products. Set to obscene values so we can always use Math.max/min
let minTime = Number.MAX_SAFE_INTEGER;
let maxTime = Number.MIN_SAFE_INTEGER;

// Name of the current policy we're filtering by
let policyFilter = null;
// Name of the current policy we're viewing on the graph
let graphPolicy = null;

// Fetch the product information
function fetchProducts(pgId) {
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

            for (let i = 0; i < missions.length; i++) {
                // Get the product information and shove it in the products object
                const mission = missions[i];
                if(checkBounds(mission)){
                    const id = mission[0];
                    products[id] = {
                        "id": id,
                        "centre": mission[1],
                        "creation": mission[2],
                        "modified": mission[3],
                        "footprint": mission[4],
                        "type": mission[5],
                        "policy": mission[6]
                    };
    
                    // Figure out the earliest and latest times
                    minTime = Math.min(minTime, products[id].creation);
                    maxTime = Math.max(maxTime, products[id].creation);
                }
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

// Generate the list of products in the sidebar
function updateProductsList(search) {
    const list = document.getElementById("products");
    list.innerHTML = ""; // clear list

    for (const id in products) {
        const product = products[id];

        // Ignore this if there's a search query and this product doesn't match it
        if (search && !id.includes(search)) {
            continue;
        }
        if (policyFilter && product.policy !== policyFilter) {
            continue;
        }

        const element = document.createElement("li");
        const link = document.createElement("a");
        link.innerText = product.id;
        link.setAttribute("href", `javascript:selectProduct("${id}");`);
        element.appendChild(link);
        list.appendChild(element);
    }
}

// Update the policy filter dropdown
function updatePoliciesList() {
    let policies = [];
    // Figure out the list of policy holders from the products list
    for (const id in products) {
        const policy = products[id].policy;
        if (!policies.includes(policy)) {
            policies.push(policy);
        }
    }

    const list = document.getElementById("policies");
    list.innerHTML = ""; // empty the list
    // Add the "all" filter
    {
        const element = document.createElement("a");
        element.innerText = "All";
        element.setAttribute("href", "javascript:;");
        element.onclick = unsetPolicyFilter;

        list.appendChild(element);
    }

    // then add the filters for each policy holder
    for (const policy of policies) {
        const element = document.createElement("a");
        element.innerText = policy;
        element.setAttribute("href", "javascript:;");
        element.onclick = setPolicyFilter;

        list.appendChild(element);
    }
}

function doSearch() {
    updateProductsList();
}

function setPolicyFilter() {
    policyFilter = this.innerText;
    updateProductsList();
}

function unsetPolicyFilter() {
    policyFilter = null;
    updateProductsList();
}

// Search callback
function doSearch() {
    const field = document.getElementById("search");
    updateProductsList(field.value);
}

// Called by getPoints when there are no more pages
function onProductsLoaded() {
    updateProductsList();
    updatePoliciesList();
    createChart();
}

// Calculate the area of a product's footprint
function calculateProductArea(product) {
    let area = 0;
    const layer = L.GeoJSON.geometryToLayer(product.footprint);
    const latlngs = layer.getLatLngs();
    for (let island of latlngs) {
        // Just in case the footprint is made of multiple polygons
        if (island.length < 2) {
            island = island[0];
        }
        area += L.GeometryUtil.geodesicArea(island);
    }
    return area;
}

// When a product is selected from the sidebar
function selectProduct(id) {
    // Bail if there's not actually a product with the given ID
    if (!products.hasOwnProperty(id)) {
        return;
    }

    currentProduct = products[id];

    // Figure out the area and the percentage of the UK's area it covers
    const ukArea = getCountryArea("GB");
    let area = calculateProductArea(currentProduct);
    const ukCoverage = area / ukArea * 100;

    // Now fill in the details
    const details = document.getElementById("details");
    details.innerHTML = `
        <strong>ID:</strong> ${id}<br/>
        <strong>Centre:</strong> ${currentProduct.centre}<br/>
        <strong>Created:</strong> ${dateFormat.format(currentProduct.creation)}<br/>
        <strong>Modified:</strong> ${dateFormat.format(currentProduct.modified)}<br/>
        <strong>Type:</strong> ${currentProduct.type}<br/>
        <strong>Area:</strong> ${L.GeometryUtil.readableArea(area, true, 3)}<br/>
        <strong>Policy:</strong> ${currentProduct.policy}<br/>
        <strong>Coverage:</strong> ${ukCoverage.toLocaleString()}%
    `;

    createChart(currentProduct.policy);
}

// Calculates the coverage data for the graphs
function calculateGraphDataSets(wantedPolicy) {
    const ukArea = getCountryArea("GB");

    // We need to sort the products by creation date

    // First, find all products that match our wanted policy
    const sortedProducts = [];
    for (const id in products) {
        if (products[id].policy === wantedPolicy) {
            sortedProducts.push(products[id]);
        }
    }

    // Now sort that list of products by creation time, earliest first
    sortedProducts.sort((a, b) => {
        if (a.creation < b.creation) return -1;
        if (a.creation > b.creation) return  1;
        return 0;
    });

    // Now generate the data for the graph
    let fields = [];
    let accum = 0;
    for (const product of sortedProducts) {
        // Turn its creation time into a JS date
        const creationTime = product.creation;
        const date = new Date(parseInt(creationTime));

        // Figure out the coverage for this product
        const productArea = calculateProductArea(product);
        const coverage = productArea / ukArea;

        // The graph is cumulative, so add it to the previous values
        accum += coverage;

        fields.push({ x: date, y: accum });
    }

    return [{
        label: wantedPolicy,
        data: fields
    }];
}

// Pretty dumb hack to generate a graph for all policies
// This essentially ensures that each policy holder has a point on the X axis.
function calculateGraphDataSetsAllPolicies() {
    const ukArea = getCountryArea("GB");

    // We need to sort the products by creation date
    // Now sort that list of products by creation time, earliest first
    const sortedProducts = [];
    for (const id in products) { sortedProducts.push(products[id]); }
    sortedProducts.sort((a, b) => {
        if (a.creation < b.creation) return -1;
        if (a.creation > b.creation) return  1;
        return 0;
    });

    // Ugly hack. This maps each product by the time it was created.
    // And generates a list of all policy holders from it.
    const productsByCreation = {};
    const policies = [];
    for (const product of sortedProducts) {
        productsByCreation[product.creation] = product;

        // If the policy holder isn't already in the list, add it
        if (!policies.includes(product.policy)) {
            policies.push(product.policy);
        }
    }

    let data = {};
    let accum = {};
    for (const creationTime in productsByCreation) {
        const product = productsByCreation[creationTime];

        // Force each policy holder to have some data on this point on the X axis
        for (const policy of policies) {
            // Initialise data for this policy holder if it hasn't been already
            if (!data.hasOwnProperty(policy)) {
                data[policy] = [];
                accum[policy] = 0;
            }

            if (product.policy === policy) {
                // Figure out the coverage for this product
                const productArea = calculateProductArea(product);
                const coverage = productArea / ukArea;

                // The graph is cumulative, so add it to the previous values
                accum[policy] += coverage;
            }

            const date = new Date(parseInt(creationTime));
            data[policy].push({ x: date, y: accum[policy] })
        }
    }

    // Generate data for chart.js
    let out = [];
    for (const policy in data) {
        out.push({
            label: policy,
            data: data[policy]
        });
    }

    return out;
}

// Initialise the chart.
function createChart(policy) {
    // Don't re-generate the chart if it's the same policy
    if (graphPolicy === policy) {
        return;
    }

    const element = document.getElementById("chart");
    const data = policy ? calculateGraphDataSets(policy) : calculateGraphDataSetsAllPolicies();
    let title = policy ? `Total coverage of the UK by policy holder ${policy}` : "Total coverage of the UK";

    // If there's already a chart, get rid of it
    if (chart) {
        chart.destroy();
        chart = null;
    }

    // and create the new chart
    chart = new Chart(element, {
        type: "line",
        data: {
            datasets: data
        },
        options: {
            scales: {
                x: {
                    type: "time"
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        min: 0,
                        // Formats the value to be percentage%
                        callback: (value) => { const pct = value * 100; return pct.toFixed(1) + "%"; }
                    },
                    title: {
                        display: true,
                        text: "Coverage of UK (%)"
                    }
                }
            },
            plugins: {
                // Enable title
                title: {
                    display: true,
                    text: title
                }
            }
        }
    });

    graphPolicy = policy;
}

// Wait until the browser has loaded everything before we start initialising things.
window.onload = function() {
    loadBorders();
    fetchProducts();
}

/* BOUNDING BOX CODE */
function checkBounds(marker){
    var NI = L.polygon(swapCoords([[-5.661948614921897, 54.55460317648385],
        [-6.197884894220977, 53.86756500916334],
        [-6.953730231137996, 54.073702297575636],
        [-7.572167934591079, 54.05995636658599],
        [-7.366030646178785, 54.595840969452695],
        [-7.572167934591079, 55.1316222194549],
        [-6.733847011736145, 55.1728600124238],
        [-5.661948614921897, 54.55460317648385]]));

    var ENG = L.polygon(swapCoords([[-3.005004848635281, 58.63500010846633],
        [-4.073828497728016, 57.55302480735526],
        [-3.055001796877661, 57.69001902936094],
        [-1.959280564776918, 57.68479970969952],
        [-2.219988165689301, 56.87001740175353],
        [-3.119003058271119, 55.973793036515474],
        [-2.085009324543023, 55.90999848085127],
        [-2.005675679673857, 55.80490285035023],
        [-1.11499101399221, 54.624986477265395],
        [-0.4304849918542, 54.46437612570216],
        [0.184981316742039, 53.32501414653103], 
        [0.469976840831777, 52.92999949809197],
        [1.681530795914739, 52.739520168664],
        [1.559987827164377, 52.09999848083601],
        [1.050561557630914, 51.806760565795685],
        [1.449865349950301, 51.28942780212196],
        [0.550333693045502, 50.765738837275876],
        [-0.78751746255864, 50.77498891865622],
        [-2.489997524414377, 50.50001862243124],
        [-2.956273972984036, 50.696879991247016],
        [-3.617448085942328, 50.22835561787272],
        [-4.542507900399244, 50.341837063185665],
        [-5.245023159191135, 49.95999990498109],
        [-5.776566941745301, 50.15967763935683],
        [-4.309989793301838, 51.21000112568916],
        [-3.414850633142123, 51.42600861266925],
        [-3.422719467108323, 51.42684816740609],
        [-4.984367234710874, 51.593466091510976],
        [-5.267295701508885, 51.991400458374585],
        [-4.222346564134853, 52.301355699261364],
        [-4.770013393564113, 52.840004991255626],
        [-4.579999152026915, 53.49500377055517],
        [-3.093830673788659, 53.404547400669685],
        [-3.092079637047107, 53.40444082296355],
        [-2.945008510744344, 53.984999701546684],
        [-3.614700825433033, 54.600936773292574],
        [-3.630005458989331, 54.615012925833014],
        [-4.844169073903004, 54.790971177786844],
        [-5.082526617849226, 55.06160065369937],
        [-4.719112107756644, 55.50847260194348],
        [-5.047980922862109, 55.78398550070753],
        [-5.58639767091114, 55.31114614523682],
        [-5.644998745130181, 56.275014960344805],
        [-6.149980841486354, 56.78500967063354],
        [-5.786824713555291, 57.81884837506465],
        [-5.009998745127575, 58.63001333275005],
        [-4.211494513353557, 58.55084503847917],
        [-3.005004848635281, 58.63500010846633]]));

    var UnitedKingdom = L.polygon([[[-5.661948614921897, 54.55460317648385],
        [-6.197884894220977, 53.86756500916334],
        [-6.953730231137996, 54.073702297575636],
        [-7.572167934591079, 54.05995636658599],
        [-7.366030646178785, 54.595840969452695],
        [-7.572167934591079, 55.1316222194549],
        [-6.733847011736145, 55.1728600124238],
        [-5.661948614921897, 54.55460317648385]]],
        [[[-3.005004848635281, 58.63500010846633],
        [-4.073828497728016, 57.55302480735526],
        [-3.055001796877661, 57.69001902936094],
        [-1.959280564776918, 57.68479970969952],
        [-2.219988165689301, 56.87001740175353],
        [-3.119003058271119, 55.973793036515474],
        [-2.085009324543023, 55.90999848085127],
        [-2.005675679673857, 55.80490285035023],
        [-1.11499101399221, 54.624986477265395],
        [-0.4304849918542, 54.46437612570216],
        [0.184981316742039, 53.32501414653103], 
        [0.469976840831777, 52.92999949809197],
        [1.681530795914739, 52.739520168664],
        [1.559987827164377, 52.09999848083601],
        [1.050561557630914, 51.806760565795685],
        [1.449865349950301, 51.28942780212196],
        [0.550333693045502, 50.765738837275876],
        [-0.78751746255864, 50.77498891865622],
        [-2.489997524414377, 50.50001862243124],
        [-2.956273972984036, 50.696879991247016],
        [-3.617448085942328, 50.22835561787272],
        [-4.542507900399244, 50.341837063185665],
        [-5.245023159191135, 49.95999990498109],
        [-5.776566941745301, 50.15967763935683],
        [-4.309989793301838, 51.21000112568916],
        [-3.414850633142123, 51.42600861266925],
        [-3.422719467108323, 51.42684816740609],
        [-4.984367234710874, 51.593466091510976],
        [-5.267295701508885, 51.991400458374585],
        [-4.222346564134853, 52.301355699261364],
        [-4.770013393564113, 52.840004991255626],
        [-4.579999152026915, 53.49500377055517],
        [-3.093830673788659, 53.404547400669685],
        [-3.092079637047107, 53.40444082296355],
        [-2.945008510744344, 53.984999701546684],
        [-3.614700825433033, 54.600936773292574],
        [-3.630005458989331, 54.615012925833014],
        [-4.844169073903004, 54.790971177786844],
        [-5.082526617849226, 55.06160065369937],
        [-4.719112107756644, 55.50847260194348],
        [-5.047980922862109, 55.78398550070753],
        [-5.58639767091114, 55.31114614523682],
        [-5.644998745130181, 56.275014960344805],
        [-6.149980841486354, 56.78500967063354],
        [-5.786824713555291, 57.81884837506465],
        [-5.009998745127575, 58.63001333275005],
        [-4.211494513353557, 58.55084503847917],
        [-3.005004848635281, 58.63500010846633]]]);

    if (NI.contains(marker.getLatLng()) || ENG.contains(marker.getLatLng())){
        return true;
    }
    else {
        return false;
    }
}

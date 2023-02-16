let products = {};
let currentProduct = null;
const dateFormat = Intl.DateTimeFormat("en-GB", {
    "dateStyle": "long",
    "timeStyle": "long"
});
const borders = {};
let chart = null;

let minTime = Number.MAX_SAFE_INTEGER;
let maxTime = Number.MIN_SAFE_INTEGER;

let policyFilter = null;
let graphPolicy = null;

function fetchProducts(pgId) {
    let url = "backend/get_products.php?";
    if (pgId) {
        url += new URLSearchParams({
            "page": pgId
        });
    }

    fetch(url)
        .then((response) => response.json())
        .then((json) => {
            const missions = json["missions"];
            if (missions.length === 0) {
                onProductsLoaded();
                return;
            }

            for (let i = 0; i < missions.length; i++) {
                const mission = missions[i];
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

                minTime = Math.min(minTime, products[id].creation);
                maxTime = Math.max(maxTime, products[id].creation);
            }

            if (json["paginationID"]) {
                getPoints(json["paginationID"]);
            } else {
                onProductsLoaded();
            }
        });
}

function updateProductsList() {
    const list = document.getElementById("products");
    list.innerHTML = ""; // clear list
    const searchBox = document.getElementById("search");
    const search = searchBox.value;

    for (const id in products) {
        const product = products[id];

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
    for (const id in products) {
        const policy = products[id].policy;
        if (!policies.includes(policy)) {
            policies.push(policy);
        }
    }

    const list = document.getElementById("policies");
    list.innerHTML = "";
    {
        const element = document.createElement("a");
        element.innerText = "All";
        element.setAttribute("href", "javascript:;");
        element.onclick = unsetPolicyFilter;

        list.appendChild(element);
    }
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

function onProductsLoaded() {
    updateProductsList();
    updatePoliciesList();
    createChart();
}

function calculateProductArea(product) {
    let area = 0;
    const layer = L.GeoJSON.geometryToLayer(product.footprint);
    const latlngs = layer.getLatLngs();
    for (let island of latlngs) {
        if (island.length < 2) {
            island = island[0];
        }
        area += L.GeometryUtil.geodesicArea(island);
    }
    return area;
}

function selectProduct(id) {
    if (!products.hasOwnProperty(id)) {
        return;
    }

    currentProduct = products[id];

    const ukArea = getCountryArea("GB");
    let area = calculateProductArea(currentProduct);
    const ukCoverage = area / ukArea * 100;

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

function calculateGraphDataSets(wantedPolicy) {
    const ukArea = getCountryArea("GB");

    const sortedProducts = [];
    for (const id in products) {
        if (products[id].policy === wantedPolicy) {
            sortedProducts.push(products[id]);
        }
    }

    sortedProducts.sort((a, b) => {
        if (a.creation < b.creation) return -1;
        if (a.creation > b.creation) return  1;
        return 0;
    });

    let fields = [];
    let accum = 0;
    for (const product of sortedProducts) {
        const creationTime = product.creation;

        const productArea = calculateProductArea(product);
        const coverage = productArea / ukArea;

        accum += coverage;

        const date = new Date(parseInt(creationTime));
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

    let out = [];
    const sortedProducts = [];
    for (const id in products) { sortedProducts.push(products[id]); }
    sortedProducts.sort((a, b) => {
        if (a.creation < b.creation) return -1;
        if (a.creation > b.creation) return  1;
        return 0;
    });

    const productsByCreation = {};
    const policies = [];
    for (const product of sortedProducts) {
        productsByCreation[product.creation] = product;
        if (!policies.includes(product.policy)) {
            policies.push(product.policy);
        }
    }

    let data = {};
    let accum = {};
    for (const creationTime in productsByCreation) {
        const product = productsByCreation[creationTime];

        for (const policy of policies) {
            if (!data.hasOwnProperty(policy)) {
                data[policy] = [];
                accum[policy] = 0;
            }

            if (product.policy === policy) {
                const productArea = calculateProductArea(product);
                const coverage = productArea / ukArea;
                accum[policy] += coverage;
            }

            const date = new Date(parseInt(creationTime));
            data[policy].push({ x: date, y: accum[policy] })
        }
    }

    for (const policy in data) {
        out.push({
            label: policy,
            data: data[policy]
        });
    }

    return out;
}

function createChart(policy) {
    if (graphPolicy === policy) {
        return;
    }

    const element = document.getElementById("chart");
    const data = policy ? calculateGraphDataSets(policy) : calculateGraphDataSetsAllPolicies();
    let title = "Total coverage of the UK";
    if (policy) {
        title = `Total coverage of the UK by policy holder ${policy}`
    }

    if (chart) {
        chart.destroy();
        chart = null;
    }

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
                        callback: (value) => { const pct = value * 100; return pct.toFixed(1) + "%"; }
                    },
                    title: {
                        display: true,
                        text: "Coverage of UK (%)"
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: title
                }
            }
        }
    });

    graphPolicy = policy;
}

window.onload = function() {
    loadBorders();
    fetchProducts();
}
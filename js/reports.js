// Map of products by their ID
let products = {};
// Product we are currently viewing a report for
let currentProduct = null;
// Date formatter
const dateFormat = Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeStyle: "long",
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

// Extract coordinates from a "12.345,67.890" string
function getCoords(string) {
  const split = string.split(",");
  return [split[0], split[1]];
}

/* BOUNDING BOX CODE */
function checkBounds(coords) {
  const border = borders["GB"];
  return border.contains({ lat: coords[0], lng: coords[1] });
}

// Fetch the product information
function fetchProducts(pgId) {
  let url = "backend/get_products.php?";
  // Pagination
  if (pgId) {
    url += new URLSearchParams({
      page: pgId,
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

        if (!checkBounds(getCoords(mission[1]))) {
          continue;
        }

        const id = mission[0];
        products[id] = {
          id: id,
          centre: mission[1],
          creation: mission[2],
          modified: mission[3],
          footprint: mission[4],
          type: mission[5],
          policy: mission[6],
        };
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
  var count = 0;  

  for (const id in products) {
    const product = products[id];

    // Ignore this if there's a search query and this product doesn't match it
    if (search && !id.includes(search)) {
      continue;
    }
    if (policyFilter && product.policy !== policyFilter) {
      continue;
    }
    /*
    <div class="sidenav-product">
        <div class="sidenav-item">
          <a href="#">Product #1</a>
          <a href="report_page.html">&#128196;</a>
        </div>
        <ul id="products"><ul>
      </div>
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
      iconLink.setAttribute("href", "report_page.html#" + product.productId);
      iconLink.innerHTML = '&#128196;';
      ul.id = "products";
      ul.innerHTML = product.productId;
  
      div.appendChild(innerDiv);
      innerDiv.appendChild(link);
      innerDiv.appendChild(iconLink);
      innerDiv.appendChild(ul);
      div.appendChild(ul);
      list.appendChild(div);
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
    link.setAttribute("href", `javascript:selectProduct("${id}");`);
    link.onclick = () => { productLinkClick(product); };
    ul.id = "products";
    ul.innerHTML = product.id;

    div.appendChild(innerDiv);
    innerDiv.appendChild(link);
    innerDiv.appendChild(iconLink);
    innerDiv.appendChild(ul);
    div.appendChild(ul);
    list.appendChild(div);


    /*
    
    link.innerText = "Product #" + count;
    link.setAttribute("href", "javascript:;");
    link.onclick = () => { productLinkClick(product.productId); };
    iconLink.setAttribute("href", "report_page.html#" + product.productId);
    iconLink.innerHTML = '&#128196;';
    ul.id = "products";
    ul.innerHTML = product.productId;

    link.style.textDecoration = "none"
    link.innerText = product.id;
    link.setAttribute("href", `javascript:selectProduct("${id}");`);
    element.appendChild(link);
    list.appendChild(element); 

    */
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

  if (window.location.hash) {
    selectProduct(window.location.hash.substring(1));
  }
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
  let area = calculateProductArea(currentProduct, true);
  const ukCoverage = (area / ukArea) * 100;

  // Now fill in the details
  const details = document.getElementById("details");
  details.innerHTML = `
        <strong>ID:</strong> ${id}<br/>
        <strong>Centre:</strong> ${currentProduct.centre}<br/>
        <strong>Created:</strong> ${dateFormat.format(
          currentProduct.creation
        )}<br/>
        <strong>Modified:</strong> ${dateFormat.format(
          currentProduct.modified
        )}<br/>
        <strong>Type:</strong> ${currentProduct.type}<br/>
        <strong>Area:</strong> ${L.GeometryUtil.readableArea(
          area,
          true,
          3
        )}<br/>
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
    if (a.creation > b.creation) return 1;
    return 0;
  });

  minTime = Number.MAX_SAFE_INTEGER;
  maxTime = Number.MIN_SAFE_INTEGER;

  // Now generate the data for the graph
  let fields = [];
  let accum = 0;
  for (const product of sortedProducts) {
    // Turn its creation time into a JS date
    const creationTime = product.creation;
    const date = new Date(parseInt(creationTime));

    // Figure out the earliest and latest times
    minTime = Math.min(minTime, creationTime);
    maxTime = Math.max(maxTime, creationTime);

    // Figure out the coverage for this product
    const productArea = calculateProductArea(product, true);
    const coverage = productArea / ukArea;

    // The graph is cumulative, so add it to the previous values
    accum += coverage;

    fields.push({ x: date, y: accum });
  }

  return [
    {
      label: wantedPolicy,
      data: fields,
    },
  ];
}

// Pretty dumb hack to generate a graph for all policies
// This essentially ensures that each policy holder has a point on the X axis.
function calculateGraphDataSetsAllPolicies() {
  const ukArea = getCountryArea("GB");

  // We need to sort the products by creation date
  // Now sort that list of products by creation time, earliest first
  const sortedProducts = [];
  for (const id in products) {
    sortedProducts.push(products[id]);
  }
  sortedProducts.sort((a, b) => {
    if (a.creation < b.creation) return -1;
    if (a.creation > b.creation) return 1;
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

  minTime = Number.MAX_SAFE_INTEGER;
  maxTime = Number.MIN_SAFE_INTEGER;

  let data = {};
  let accum = {};
  for (const creationTime in productsByCreation) {
    const product = productsByCreation[creationTime];

    // Figure out the earliest and latest times
    minTime = Math.min(minTime, product.creation);
    maxTime = Math.max(maxTime, product.creation);

    // Force each policy holder to have some data on this point on the X axis
    for (const policy of policies) {
      // Initialise data for this policy holder if it hasn't been already
      if (!data.hasOwnProperty(policy)) {
        data[policy] = [];
        accum[policy] = 0;
      }

      if (product.policy === policy) {
        // Figure out the coverage for this product
        const productArea = calculateProductArea(product, true);
        const coverage = productArea / ukArea;

        // The graph is cumulative, so add it to the previous values
        accum[policy] += coverage;
      }

      const date = new Date(parseInt(creationTime));
      data[policy].push({ x: date, y: accum[policy] });
    }
  }

  // Generate data for chart.js
  let out = [];
  for (const policy in data) {
    out.push({
      label: policy,
      data: data[policy],
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
  const data = policy
    ? calculateGraphDataSets(policy)
    : calculateGraphDataSetsAllPolicies();
  let title = policy
    ? `Total coverage of the UK by policy holder ${policy}`
    : "Total coverage of the UK";

  // If there's already a chart, get rid of it
  if (chart) {
    chart.destroy();
    chart = null;
  }

  // and create the new chart
  chart = new Chart(element, {
    type: "line",
    data: {
      datasets: data,
    },
    options: {
      scales: {
        x: {
          type: "time",
        },
        y: {
          beginAtZero: true,
          ticks: {
            min: 0,
            // Formats the value to be percentage%
            callback: (value) => {
              const pct = value * 100;
              return pct.toFixed(1) + "%";
            },
          },
          title: {
            display: true,
            text: "Coverage of UK (%)",
          },
          zoom: {
            wheel: {
              enabled: true,
            },
          },
        },
      },
      plugins: {
        // Enable title
        title: {
          display: true,
          text: title,
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x'
          },
          zoom: {
            wheel: {
              enabled: true,
            },
            mode: 'x'
          },
          limits: {
            x: {min: minTime, max: maxTime}
          }
        },
      },
    },
  });

  graphPolicy = policy;
}

// Wait until the browser has loaded everything before we start initialising things.
window.onload = function () {
  loadBorders();
  fetchProducts();
};

// Swap each component in each coordinate in a list of coordinates.
function swapCoords(list) {
  let out = [];
  for (let i = 0; i < list.length; i++) {
    out.push([list[i][1], list[i][0]]);
  }
  return out;
}

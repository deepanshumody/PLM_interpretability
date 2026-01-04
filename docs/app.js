function fmt(x, digits = 4) {
  if (x === undefined || x === null) return "—";
  return Number(x).toFixed(digits);
}
let FEATURES_BY_ID = new Map();
let FEATURES_META = null;

async function loadFeaturesForGraph(graphFileName) {
  // Map graph file -> features file
  const isTM = graphFileName.toLowerCase().includes("tm");
  const featuresFile = isTM ? "features_tm.json" : "features_sp.json";

  try {
    const res = await fetch(`./data/${featuresFile}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const obj = await res.json();

    FEATURES_META = obj.meta || null;
    FEATURES_BY_ID = new Map((obj.features || []).map(f => [f.id, f]));

    return { ok: true, featuresFile, count: FEATURES_BY_ID.size };
  } catch (e) {
    FEATURES_META = null;
    FEATURES_BY_ID = new Map();
    return { ok: false, featuresFile, error: e.message };
  }
}

async function loadGraph(fileName) {
  const res = await fetch(`./data/${fileName}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch graph: ${fileName}`);
  return await res.json();
}

function toCytoscapeElements(graph, minEdgeWeight, maxEdgesPerNode) {
  const nodes = graph.nodes.map(n => ({
    data: { id: n.id, ...n }
  }));

  // Filter edges by weight first
  let edges = graph.edges
    .filter(e => (e.weight ?? 0) >= minEdgeWeight)
    .map((e, idx) => ({
      data: {
        id: `e${idx}`,
        source: e.src,
        target: e.dst,
        ...e
      }
    }));

  // Limit outgoing edges per source node (keeps graph readable)
  const bySrc = new Map();
  for (const e of edges) {
    const src = e.data.source;
    if (!bySrc.has(src)) bySrc.set(src, []);
    bySrc.get(src).push(e);
  }

  const prunedEdges = [];
  for (const [src, arr] of bySrc.entries()) {
    arr.sort((a, b) => (b.data.weight ?? 0) - (a.data.weight ?? 0));
    prunedEdges.push(...arr.slice(0, maxEdgesPerNode));
  }

  return { nodes, edges: prunedEdges };
}

function nodeStyle(n) {
  // Different shape for behavior node
  if (n.data.kind === "behavior") return { shape: "round-rectangle", size: 28 };
  return { shape: "ellipse", size: 18 };
}

function buildCy(container, elements) {
  const cy = cytoscape({
    container,
    elements: [...elements.nodes, ...elements.edges],
    layout: { name: "cose", animate: false, fit: true, padding: 30 },
    style: [
      {
        selector: "node",
        style: {
          "label": "data(id)",
          "font-size": 8,
          "text-wrap": "wrap",
          "text-max-width": 80,
          "color": "#e8f0f7",
          "text-outline-width": 2,
          "text-outline-color": "#0b1118",
          "background-color": (ele) => {
            if (ele.data("kind") === "behavior") return "#2fd0b5";
            const layer = ele.data("layer");
            // simple deterministic color palette by layer
            const palette = ["#4adbbd", "#f5c66a", "#79aef2", "#f08a5d", "#7bd88f", "#e36b5b"];
            if (layer === undefined || layer === null) return "#9fb0c0";
            return palette[Math.abs(layer) % palette.length];
          },
          "width": (ele) => nodeStyle(ele).size,
          "height": (ele) => nodeStyle(ele).size,
          "shape": (ele) => nodeStyle(ele).shape,
          "border-width": 1,
          "border-color": "rgba(255,255,255,0.2)"
        }
      },
      {
        selector: "edge",
        style: {
          "curve-style": "bezier",
          "target-arrow-shape": "triangle",
          "arrow-scale": 0.8,
          "line-color": "rgba(232, 240, 247, 0.16)",
          "target-arrow-color": "rgba(232, 240, 247, 0.25)",
          "width": (ele) => {
            const w = ele.data("weight") ?? 0;
            return Math.min(6, 0.5 + 10 * w);
          }
        }
      },
      {
        selector: ".highlight",
        style: {
          "border-width": 3,
          "border-color": "#f2c15b",
          "line-color": "#f2c15b",
          "target-arrow-color": "#f2c15b"
        }
      }
    ]
  });

  return cy;
}

function showDetails(html) {
  document.getElementById("details").innerHTML = html;
}

function setupInteractions(cy) {
  cy.on("tap", "node", (evt) => {
    const n = evt.target;
    const d = n.data();

    // highlight node + its outgoing edges
    cy.elements().removeClass("highlight");
    n.addClass("highlight");
    n.outgoers("edge").addClass("highlight");

    if (d.kind === "behavior") {
      showDetails(`
        <p><b>Behavior node</b></p>
        <p><code>${d.id}</code></p>
        <p>This is the target behavior the circuit supports.</p>
      `);
    } else {
        const featureHtml = `
          <p><b>SAE Feature</b></p>
          <p><code>${d.id}</code></p>
          <p>Layer: <code>${d.layer ?? "?"}</code></p>
          <p>Feature index: <code>${d.feature ?? "?"}</code></p>
          <p>Importance (Δloss when ablated): <code>${fmt(d.importance, 6)}</code></p>
          <div id="seqViewerMount"></div>
        `;
        showDetails(featureHtml);
  
        // Render examples (if features.json is loaded)
        const f = FEATURES_BY_ID.get(d.id);
        const mount = document.getElementById("seqViewerMount");
  
        if (f && mount && window.SequenceViewer) {
          window.SequenceViewer.renderInto(mount, f, {
            behavior: (FEATURES_META?.behavior || "tm"),
            lineLen: 60,
            maxExamples: 8,
          });
        } else if (mount) {
            mount.innerHTML = `
            <div style="color: var(--muted); font-size: 12px; line-height: 1.4;">
              <b>Sequence viewer unavailable.</b><br/>
              Missing either:
              <ul style="margin: 6px 0 0 16px; padding: 0;">
                <li><code>sequence_viewer.js</code> not loaded</li>
                <li><code>data/features_tm.json</code> or <code>data/features_sp.json</code> not found</li>
                <li>this feature id (<code>${d.id}</code>) not present in the features file</li>
              </ul>
            </div>
          `;
          
        }
      }
  

  });

  cy.on("tap", "edge", (evt) => {
    const e = evt.target;
    const d = e.data();

    cy.elements().removeClass("highlight");
    e.addClass("highlight");
    e.source().addClass("highlight");
    e.target().addClass("highlight");

    showDetails(`
      <p><b>Edge</b></p>
      <p><code>${d.source}</code> → <code>${d.target}</code></p>
      <p>Kind: <code>${d.kind ?? "edge"}</code></p>
      <p>Weight: <code>${fmt(d.weight, 6)}</code></p>
    `);
  });
}

async function boot() {
  const graphSelect = document.getElementById("graphSelect");
  const minEdge = document.getElementById("minEdge");
  const minEdgeVal = document.getElementById("minEdgeVal");
  const maxEdges = document.getElementById("maxEdges");
  const fitBtn = document.getElementById("fitBtn");

  let cy = null;

  async function render() {
    minEdgeVal.textContent = Number(minEdge.value).toFixed(2);

    const graph = await loadGraph(graphSelect.value);
        // Load features.json alongside the graph (optional but recommended)
    const featStatus = await loadFeaturesForGraph(graphSelect.value);
    if (!featStatus.ok) {
        console.warn("features.json not loaded:", featStatus);
    } else {
        console.log(`Loaded ${featStatus.count} features from ${featStatus.featuresFile}`);
    }
    
    const elems = toCytoscapeElements(graph, Number(minEdge.value), Number(maxEdges.value));

    const container = document.getElementById("cy");
    container.innerHTML = "";
    
    cy = buildCy(container, elems);
    setupInteractions(cy);
    cy.fit();
    showDetails(`<p>Loaded <code>${graphSelect.value}</code>. Click a node/edge.</p>`);
  }

  graphSelect.addEventListener("change", render);
  minEdge.addEventListener("input", () => render());
  maxEdges.addEventListener("change", render);
  fitBtn.addEventListener("click", () => cy && cy.fit());

  await render();
}

boot().catch(err => {
  console.error(err);
  showDetails(`<p style="color:#ff7b72"><b>Error:</b> ${err.message}</p>`);
});

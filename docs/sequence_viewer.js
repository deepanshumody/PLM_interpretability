// sequence_viewer.js
// Minimal sequence renderer for features.json examples.
// Highlights:
//   - behavior segments (TM or SP): .aa.beh
//   - feature mask segments:        .aa.feat
//   - both:                         .aa.both
//   - top positions:                .aa.top
//
// features.json schema expected (per example):
// {
//   accession, sequence,
//   behavior, behavior_segments: [[s,e], ...],
//   feature_segments: [[s,e], ...],
//   top_positions: [{pos, act}, ...],
//   max_act, threshold, overlap_frac_feature_in_behavior
// }
//
// NOTE: segments are 0-indexed inclusive; display uses 1-indexed positions.

(function () {
    function escapeHtml(str) {
      return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }
  
    function clampSegs(segs, L) {
      if (!Array.isArray(segs)) return [];
      const out = [];
      for (const s of segs) {
        if (!Array.isArray(s) || s.length < 2) continue;
        let a = Math.max(0, Math.min(L - 1, Number(s[0])));
        let b = Math.max(0, Math.min(L - 1, Number(s[1])));
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
        if (b < a) [a, b] = [b, a];
        out.push([a, b]);
      }
      return out;
    }
  
    function segmentsToMask(segs, L) {
      const mask = new Array(L).fill(false);
      for (const [a, b] of clampSegs(segs, L)) {
        for (let i = a; i <= b; i++) mask[i] = true;
      }
      return mask;
    }
  
    function topPositionsToMap(topPositions) {
      const m = new Map();
      if (!Array.isArray(topPositions)) return m;
      for (const t of topPositions) {
        if (!t) continue;
        const pos = Number(t.pos);
        const act = Number(t.act);
        if (Number.isFinite(pos) && Number.isFinite(act)) {
          m.set(pos, act);
        }
      }
      return m;
    }
  
    function segsToString(segs) {
      if (!segs || segs.length === 0) return "—";
      // Display 1-indexed
      return segs.map(([a, b]) => `${a + 1}-${b + 1}`).join(", ");
    }
  
    function renderExampleHTML(example, opts = {}) {
      const lineLen = opts.lineLen ?? 60;
      const behaviorLabel = opts.behaviorLabel ?? "Behavior";
  
      const seq = example.sequence || "";
      const L = seq.length;
  
      const behSegs = clampSegs(example.behavior_segments || [], L);
      const featSegs = clampSegs(example.feature_segments || [], L);
  
      const behMask = segmentsToMask(behSegs, L);
      const featMask = segmentsToMask(featSegs, L);
  
      const topMap = topPositionsToMap(example.top_positions || []);
  
      const maxAct = example.max_act ?? null;
      const thr = example.threshold ?? null;
      const overlap = example.overlap_frac_feature_in_behavior ?? null;
  
      const header = `
        <div class="seqMeta">
          <div><span class="k">Accession</span>: <span class="mono">${escapeHtml(example.accession || "—")}</span></div>
          <div><span class="k">${escapeHtml(behaviorLabel)} segments</span>: <span class="mono">${escapeHtml(segsToString(behSegs))}</span></div>
          <div><span class="k">Feature mask segments</span>: <span class="mono">${escapeHtml(segsToString(featSegs))}</span></div>
          <div class="seqStats">
            <span class="pill">max_act: <span class="mono">${maxAct === null ? "—" : Number(maxAct).toFixed(4)}</span></span>
            <span class="pill">thr: <span class="mono">${thr === null ? "—" : Number(thr).toFixed(4)}</span></span>
            <span class="pill">overlap: <span class="mono">${overlap === null ? "—" : Number(overlap).toFixed(3)}</span></span>
          </div>
        </div>
      `;
  
      const legend = `
        <div class="seqLegend">
          <span class="legendItem"><span class="swatch beh"></span> ${escapeHtml(behaviorLabel)}</span>
          <span class="legendItem"><span class="swatch feat"></span> Feature mask</span>
          <span class="legendItem"><span class="swatch both"></span> Both</span>
          <span class="legendItem"><span class="swatch top"></span> Top position</span>
        </div>
      `;
  
      const lines = [];
      for (let start = 0; start < L; start += lineLen) {
        const end = Math.min(L, start + lineLen);
        const spans = [];
        for (let i = start; i < end; i++) {
          const aa = seq[i];
          const inBeh = behMask[i];
          const inFeat = featMask[i];
  
          let cls = "aa";
          if (inBeh && inFeat) cls += " both";
          else if (inBeh) cls += " beh";
          else if (inFeat) cls += " feat";
  
          const act = topMap.get(i);
          const isTop = act !== undefined;
          if (isTop) cls += " top";
  
          const title = [
            `pos=${i + 1}`,
            `aa=${aa}`,
            `${behaviorLabel.toLowerCase()}=${inBeh ? 1 : 0}`,
            `feat=${inFeat ? 1 : 0}`,
            isTop ? `act=${act.toFixed(4)}` : null,
          ].filter(Boolean).join(" ");
  
          spans.push(`<span class="${cls}" title="${escapeHtml(title)}">${escapeHtml(aa)}</span>`);
        }
  
        const leftIdx = String(start + 1).padStart(5, " ");
        const rightIdx = String(end).padStart(5, " ");
        lines.push(`
          <div class="seqLine">
            <span class="seqIdx mono">${leftIdx}</span>
            <span class="seqResidues mono">${spans.join("")}</span>
            <span class="seqIdx mono">${rightIdx}</span>
          </div>
        `);
      }
  
      return `
        ${legend}
        ${header}
        <div class="seqBlock">
          ${lines.join("")}
        </div>
      `;
    }
  
    function renderInto(rootEl, featureObj, opts = {}) {
      if (!rootEl) return;
      rootEl.innerHTML = "";
  
      const behavior = (opts.behavior || featureObj?.examples?.[0]?.behavior || "tm").toLowerCase();
      const behaviorLabel = behavior === "tm" ? "TM" : (behavior === "sp" ? "SP" : "Behavior");
  
      const examples = Array.isArray(featureObj?.examples) ? featureObj.examples : [];
      if (examples.length === 0) {
        rootEl.innerHTML = `<div class="muted">No examples available for this feature.</div>`;
        return;
      }
  
      const maxExamples = opts.maxExamples ?? 8;
      const showExamples = examples.slice(0, maxExamples);
  
      const wrap = document.createElement("div");
      wrap.className = "seqViewerWrap";
  
      const header = document.createElement("div");
      header.className = "seqViewerHeader";
      header.innerHTML = `
        <div class="seqViewerTitle">
          <div><b>Examples</b> (top activating proteins)</div>
          <div class="muted small">Choose an example to view residue-level highlights.</div>
        </div>
        <div class="seqViewerControls">
          <label class="muted small">Example:</label>
          <select class="seqExampleSelect">
            ${showExamples.map((ex, i) => {
              const acc = escapeHtml(ex.accession || `ex${i+1}`);
              const mx = ex.max_act == null ? "—" : Number(ex.max_act).toFixed(3);
              return `<option value="${i}">${i+1}. ${acc} (max_act=${mx})</option>`;
            }).join("")}
          </select>
        </div>
      `;
  
      const viewer = document.createElement("div");
      viewer.className = "seqExampleViewer";
  
      function renderExample(i) {
        const ex = showExamples[i];
        viewer.innerHTML = renderExampleHTML(ex, {
          lineLen: opts.lineLen ?? 60,
          behaviorLabel
        });
      }
  
      wrap.appendChild(header);
      wrap.appendChild(viewer);
      rootEl.appendChild(wrap);
  
      const select = header.querySelector(".seqExampleSelect");
      select.addEventListener("change", () => {
        const i = Number(select.value);
        renderExample(i);
      });
  
      renderExample(0);
    }
  
    // Expose globally
    window.SequenceViewer = {
      renderInto,
      renderExampleHTML,
    };
  })();
  
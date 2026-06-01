# PLM Interpretability — Sparse-Autoencoder Feature Circuits in ESM-2

Mechanistic interpretability of a **protein language model**. I train top-k sparse
autoencoders (SAEs) on the internal activations of **ESM-2** and use causal ablation to
build **feature circuits** that explain how the model detects two interpretable biological
behaviors: **transmembrane (TM) helices** and **signal peptides (SP)**.

### 🔎 [**Explore the interactive circuit viewer →**](https://deepanshumody.github.io/PLM_interpretability/)

An interactive Cytoscape.js graph: click any SAE feature to see its causal edges, its
top-activating protein sequences, and where along each sequence it fires.

---

## TL;DR

- **Model:** ESM-2 (`esm2_t6_8M`), reading residual-stream activations at layers **2** and **5**.
- **Features:** top-k sparse autoencoders (`d_sae = 2048`, `k = 32`) trained to give a sparse,
  human-inspectable basis over those activations.
- **Circuits:** built by **causal ablation** —
  - *feature → behavior* edges measure the change in task loss (Δloss) when a feature is ablated;
  - *feature → feature* edges measure the downstream effect of ablating one feature on another.
- **Behaviors studied:** transmembrane-helix detection and signal-peptide detection
  (e.g. the TM circuit has **86 nodes / 220 edges**).
- **Result:** a small, sparse subgraph of features is sufficient to account for each behavior,
  with per-feature evidence (top-activating proteins + position-level activations).

## What's in this repo

This repository hosts the **interactive results artifact** and the underlying circuit data:

```
docs/
├── index.html            # Cytoscape.js circuit explorer (served via GitHub Pages)
├── app.js                # graph rendering + interaction
├── sequence_viewer.js    # per-feature top sequences & position-level activations
├── style.css
└── data/
    ├── tm_circuit_graph.json   # transmembrane feature circuit (nodes + edges)
    ├── sp_circuit_graph.json   # signal-peptide feature circuit
    ├── features_tm.json        # per-feature top-activating sequences (TM)
    └── features_sp.json        # per-feature top-activating sequences (SP)
```

## View locally

```bash
# any static server works; from the repo root:
python -m http.server 8000 --directory docs
# then open http://localhost:8000
```

## Background

- **Sparse autoencoders** decompose a model's activations into a larger, sparsely-active set of
  features that tend to be more monosemantic than raw neurons.
- **ESM-2** (Lin et al., 2023) is a transformer protein language model; its representations are
  known to encode structural and functional properties of proteins.
- **Transmembrane helices** and **signal peptides** are well-defined sequence/structure motifs,
  which makes them good ground-truth behaviors for testing whether SAE features are causally
  responsible for a model's predictions.

---

*Part of my work on mechanistic interpretability — see also
[increasing-refusal-intervention-robustness](https://github.com/deepanshumody/increasing-refusal-intervention-robustness)
(refusal directions in LLMs) and [llm_hmm_token](https://github.com/deepanshumody/llm_hmm_token)
(latent reasoning phases).*

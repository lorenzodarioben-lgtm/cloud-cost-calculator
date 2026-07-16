# Changelog

All notable changes to this project are documented here. This project adheres to
semantic-versioning-style headings.

## 2.0.0 - FinOps workbench

A major expansion from a simple EC2/EBS estimator into a multi-service planning
workbench.

### Added

- Normalized, DOM-independent workload/estimate model with a service registry.
- Region-aware sample pricing for US East (N. Virginia), US West (Oregon),
  Asia Pacific (Sydney), and Europe (Ireland).
- Expanded EC2 (quantity, runtime, presets) and EBS (volume count, per-volume
  size, enable/disable) estimation.
- New optional service models: S3 object storage, RDS database, and outbound
  data transfer.
- Budget intelligence: annualized total, budget-used percent, remaining/overage,
  healthy/watch/risk/over classification, an accessible progress bar, and
  deterministic recommendations from the largest cost drivers.
- Complete multi-service workload presets.
- Named scenario management (save, load, rename, delete) with versioned,
  defensive local storage.
- Scenario comparison with per-service and total monthly/annual deltas.
- Accessible SVG cost breakdown chart with a text legend equivalent.
- JSON export/import (with schema validation), CSV export, and shareable URLs.
- Light, dark, and system themes with a persisted preference.
- Static quality gate and a CI matrix across Node 20, 22, and 24.

### Changed

- Rebuilt the interface as a coherent, token-based FinOps dashboard with a
  single accent, one radius scale, and full light/dark support.
- Removed the oversized marketing hero and decorative panels; the calculator is
  now the visual centre.
- Replaced `innerHTML` rendering with safe DOM construction throughout.
- Rewrote and corrected all project documentation.

### Fixed

- Corrupted documentation (encoding artefacts and escaped markdown).
- Colour-only budget signalling; state now has a text label.

## 1.0.0 - Initial release

### Added

- EC2 monthly compute estimate and EBS storage estimate.
- Monthly total and a budget warning system.
- Usage presets for common monthly-hour patterns and editable sample rates.
- Local browser state saving and a reset-to-defaults action.
- Node test suite and a GitHub Actions validation workflow.
- GitHub Pages-compatible static frontend and supporting documentation.

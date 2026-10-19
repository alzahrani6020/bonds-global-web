# Bonds V3 Performance Budget

These limits are operational acceptance criteria for new V3 features.

## Taxonomy and catalog

- First taxonomy load must not include project models, market rows, regulatory details, or financial assumptions.
- Default investment taxonomy response returns sectors and subsectors only.
- Activities are loaded only with `include=activities`.
- Cross-cutting dimensions are loaded only with `include=dimensions`.
- A sector filter should be used once the user enters a sector.
- Static/reference responses should use cache headers.

## Data loading

- Project models load only after activity selection.
- Market data loads only after country/city/activity context is known.
- Country regulatory data loads only for the selected country/activity.
- Avoid N+1 queries; use batched `in(...)` queries or parallel independent requests.
- Large lists must be filtered or paginated before they grow beyond current catalog sizes.

## Frontend

- Do not add heavy frontend dependencies for taxonomy navigation.
- Do not block first render on financial, market, or regulatory data.
- Preserve existing pages and APIs until the replacement path passes CI and runtime checks.
- Prefer lazy/on-demand loading for secondary panels.

## Current measured baseline

- canonical sectors + subsectors summary: approximately 36.8 KB uncompressed JSON source data.
- single-sector summary (health): approximately 1.1 KB uncompressed JSON source data.
- canonical activities and mapping data are excluded from the default response.

## Merge gate

A change must not be merged if it:
- introduces cross-country fallback,
- loads the full 837-model catalog on initial page load,
- adds an obvious N+1 query path,
- materially increases first-load taxonomy payload without justification,
- removes cacheability from static taxonomy responses,
- breaks existing V3 API contracts without a staged migration.

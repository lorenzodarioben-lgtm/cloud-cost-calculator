# Architecture

The application is plain HTML, CSS, and dependency-free ES modules. The guiding
principle is a **pure, testable calculation core** kept strictly separate from a
single DOM-orchestration module.

## Layers

```text
             ┌───────────────────────────────────────────────┐
 DOM layer   │  app.js  (the only module that touches the DOM) │
             └───────────────┬───────────────────────────────┘
                             │ reads inputs -> builds a workload
                             v
 Model       │  state.js     workload schema, normalization, presets
             │  validation.js numeric coercion / clamping primitives
                             │
                             v
 Engine      │  calculator.js  estimateWorkload() -> structured estimate
             │  pricing.js      region-aware sample rate catalogue
                             │
             ┌───────────────┴───────────────────────────────┐
 Features    │ recommendations.js  charts.js  compare.js       │
             │ scenarios.js  export.js  share.js  theme.js      │
             └───────────────────────────────────────────────┘
```

Only `app.js` imports the DOM. Every other module is pure data-in / data-out (or
storage-injectable), which is why the test suite can exercise the whole system
in Node without a browser.

## The workload model

A **workload** is the single source of truth: a region, a monthly budget, and a
set of service configurations.

```js
{
  version: 1,
  region: 'us-east-1',
  budget: 15,
  services: {
    ec2:          { enabled, instanceType, quantity, hours, rate },
    ebs:          { enabled, volumeType, volumes, sizeGb, rate },
    s3:           { enabled, storageClass, storageGb, rate, requests, requestRate },
    rds:          { enabled, engine, instanceClass, quantity, hours, instanceRate, storageGb, storageRate },
    dataTransfer: { enabled, outboundGb, rate },
  }
}
```

`normalizeWorkload()` coerces any untrusted object (persisted state, imported
file, shared URL) into this shape: invalid, infinite, negative, or missing
numbers collapse to safe values, and unknown fields are dropped. It never throws.

## The estimate

`estimateWorkload(workload)` returns plain data suitable for rendering,
exporting, and comparison:

```js
{
  region, currency,
  lineItems: [{ service, serviceLabel, label, detail, amount }],
  serviceSubtotals: { [serviceId]: amount },   // enabled services only
  services: [{ id, label, amount, enabled }],  // all services (for charts)
  total, annualTotal,
  budget, budgetUsedPercent, remaining, overage, overBudget,
  budgetStatus,  // 'no-budget' | 'healthy' | 'watch' | 'risk' | 'over'
}
```

## Service registry (extension point)

`SERVICE_DEFINITIONS` in `calculator.js` is an array of `{ id, label, estimate }`.
Each `estimate(service)` returns one or more line items. Adding a new AWS service
means appending one entry there and a matching config in the workload model;
totals, subtotals, the chart, exports, and comparison all pick it up
automatically.

## Data flow on input

1. The user edits a control; `app.js` reads the form into a workload.
2. `estimateWorkload()` produces the estimate.
3. `app.js` renders the total, line items, breakdown chart, budget health, and
   recommendations, and refreshes any active scenario comparison.
4. The workload is persisted to local storage for the next visit.

## Persistence and portability

- **Scenarios** (`scenarios.js`) use a versioned local-storage envelope with
  per-entry sanitization and migration; corrupt data degrades to an empty list.
- **Export/import** (`export.js`) uses a versioned JSON envelope; import accepts
  an envelope or a bare workload and validates before applying.
- **Sharing** (`share.js`) encodes the workload as URL-safe base64; decoding is
  defensive and yields `null` for tampered state.

All three funnel back through `normalizeWorkload()`, so no external input can put
the app into an invalid state.

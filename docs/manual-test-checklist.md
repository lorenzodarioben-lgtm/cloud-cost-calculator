# Manual Test Checklist

Run through this before publishing changes. Pair it with `npm run validate`.

## Load and defaults

- [ ] The page loads with no console errors and no failed local assets.
- [ ] The default estimate shows `$9.99/month` and a "Healthy" budget status.
- [ ] Region, instance, volume, and S3/RDS class selects are populated.

## Services

- [ ] Changing EC2 instances, hours, or rate updates the estimate.
- [ ] Changing EBS volumes, size, or rate updates the estimate.
- [ ] Enabling S3 adds storage and request line items.
- [ ] Enabling RDS adds instance and storage line items.
- [ ] Enabling data transfer adds an outbound line item.
- [ ] Disabling a service dims it, disables its inputs, and removes it from the total.

## Region and presets

- [ ] Switching region re-syncs rates (Sydney is pricier than N. Virginia).
- [ ] Each workload preset updates the whole configuration and marks the chip pressed.
- [ ] Editing any field clears the pressed preset chip.
- [ ] Runtime presets set EC2 monthly hours.

## Budget health

- [ ] A budget above the estimate shows healthy/watch and the progress bar fills.
- [ ] A budget below the estimate shows "Over budget" and an overage amount.
- [ ] A zero budget shows "No budget set" and `n/a` for percent/remaining.
- [ ] Recommendations name the largest cost driver and read sensibly.

## Cost breakdown

- [ ] The donut and legend show each enabled service's share and amount.
- [ ] Zeroing all services shows the breakdown empty state.

## Scenarios

- [ ] Saving names the scenario, shows its monthly total, and hides the empty state.
- [ ] Load restores a saved workload; Rename and Delete work.
- [ ] Reloading the page does not break the calculator with saved state present.

## Comparison

- [ ] Selecting a saved scenario shows per-service and total monthly/annual deltas.
- [ ] The summary states which side is cheaper; equal totals are handled.
- [ ] The comparison table stacks into cards on a narrow screen.

## Export, import, share

- [ ] Export JSON and Export CSV download files with readable names.
- [ ] Importing an exported JSON file restores the workload.
- [ ] Importing malformed JSON shows an error, not a crash.
- [ ] Copy share link produces a URL; opening it loads that workload.
- [ ] A malformed `?s=` link falls back to the saved estimate with a notice.

## Theme and reduced motion

- [ ] System, Light, and Dark toggle the theme and persist across reloads.
- [ ] Both themes are readable with no clipped or low-contrast text.
- [ ] With reduced motion enabled, transitions and smooth scrolling are disabled.

## Responsive

- [ ] No horizontal overflow at 1440, 1024, 768, 390, and 320 px.
- [ ] No overlapping controls or cut-off text at any width.
- [ ] Inputs remain usable and labels readable on small screens.

## Keyboard and focus

- [ ] The skip link is the first focusable element and works.
- [ ] Every control is reachable by keyboard with a visible focus ring.

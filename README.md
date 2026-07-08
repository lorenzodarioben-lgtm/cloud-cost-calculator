# Cloud Cost Calculator

A simple AWS cost estimator mockup that calculates a monthly estimate from EC2 compute and EBS storage, then warns when the estimate goes over budget.

## Features

- EC2 monthly hours × hourly rate
- EBS storage GB × GB-month rate
- Monthly total estimate
- Budget warning when the estimate is over budget
- Presets for 40h, 160h, and 730h usage
- Editable rates so the mockup can be adjusted for different regions or instance types
- Lightweight static frontend with no runtime dependencies
- Node test suite and GitHub Actions validation

## Demo assumptions

The default rates are intentionally simple and transparent:

| Item | Default | Source basis |
| --- | ---: | --- |
| EC2 `t3.micro` Linux/Unix, US East (N. Virginia) | `$0.0104/hour` | AWS T3 instance pricing page |
| EBS `gp3` storage | `$0.08/GB-month` | AWS EBS gp3 pricing example |
| Always-on month | `730 hours` | Common rough monthly estimate |

> This is a learning project, not an official AWS quote. Real AWS bills can include region differences, OS differences, taxes, free tier credits, CPU credits, snapshots, data transfer, load balancers, monitoring, and other services.

## Quick start

Open `index.html` directly in a browser, or use any static file server.

```bash
# optional validation
npm run validate
```

## Project structure

```text
cloud-cost-calculator/
├── .github/workflows/ci.yml
├── index.html
├── package.json
├── scripts/check-syntax.mjs
├── src/
│   ├── app.js
│   ├── calculator.js
│   ├── pricing.js
│   └── styles.css
└── test/calculator.test.js
```

## Formula

```text
compute cost = EC2 hours × EC2 hourly rate
storage cost = storage GB × storage GB-month rate
monthly estimate = compute cost + storage cost
```

Example using the defaults:

```text
EC2: 730 × 0.0104 = 7.592
Storage: 30 × 0.08 = 2.40
Total: 9.992 ≈ $9.99/month
```

## GitHub Pages

This project is static, so it can be deployed with GitHub Pages:

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/root` folder.
5. Save.

## Suggested GitHub topics

```text
aws cloud-cost-calculator ec2 ebs javascript github-pages cloud-computing cost-estimator
```

## Future improvements

- Add more AWS regions
- Add S3 storage pricing
- Add RDS estimate cards
- Add export-to-CSV for estimates
- Add light/dark mode toggle
- Add comparison between always-on and part-time usage

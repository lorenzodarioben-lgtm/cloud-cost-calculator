# Pricing Assumptions

This project is a simplified AWS cost estimator for learning and portfolio use.
Every rate below is a **curated sample assumption**. Rates are **not fetched
live** and are **not an official AWS quote**. Real bills vary by region,
operating system, usage model, taxes, free-tier credits, data transfer,
snapshots, monitoring, commitment discounts, and other services.

## Regions and currency

The catalogue covers four representative regions and bills in USD:

- `us-east-1` - US East (N. Virginia)
- `us-west-2` - US West (Oregon)
- `ap-southeast-2` - Asia Pacific (Sydney)
- `eu-west-1` - Europe (Ireland)

To stay honest and maintainable, each region is the us-east-1 reference table
scaled by a transparent per-region factor rather than independently sourced
numbers:

| Region | Factor (sample) |
| --- | --- |
| US East (N. Virginia) | 1.00 |
| US West (Oregon) | 1.00 |
| Asia Pacific (Sydney) | 1.27 |
| Europe (Ireland) | 1.08 |

All rates are editable in the UI, so you can override any assumption for a
specific region, OS, or pricing model.

## Reference rates (us-east-1, factor 1.0)

### EC2 compute (Linux/Unix, on-demand, USD/hour)

| Instance | Sample rate |
| --- | ---: |
| t3.nano | 0.0052 |
| t3.micro | 0.0104 |
| t3.small | 0.0208 |
| t3.medium | 0.0416 |
| t3.large | 0.0832 |
| m5.large | 0.096 |
| c5.large | 0.085 |

Cost model: `quantity × monthly hours × hourly rate`. A rough always-on month is
730 hours; the runtime presets are development (40h), part-time (160h), business
hours (260h), and always-on (730h).

### EBS storage (USD/GB-month)

| Volume type | Sample rate |
| --- | ---: |
| gp3 | 0.08 |
| gp2 | 0.10 |
| io2 | 0.125 |
| st1 | 0.045 |
| sc1 | 0.015 |

Cost model: `volumes × storage-per-volume (GB) × GB-month rate`. Provisioned IOPS
and throughput charges are not modelled.

### S3 object storage

| Storage class | Sample rate (USD/GB-month) |
| --- | ---: |
| S3 Standard | 0.023 |
| S3 Standard-IA | 0.0125 |
| S3 One Zone-IA | 0.01 |
| S3 Glacier Instant Retrieval | 0.004 |

Requests use a single blended sample rate of `0.0004` USD per 1,000 requests.
Cost model: `GB × GB-month rate` plus `requests / 1000 × request rate`. Real S3
prices GET, PUT, and other request types separately, and adds retrieval and
lifecycle-transition charges that are not modelled here.

### RDS database

| Instance class | Sample rate (USD/hour) |
| --- | ---: |
| db.t3.micro | 0.017 |
| db.t3.small | 0.034 |
| db.t3.medium | 0.068 |
| db.m5.large | 0.171 |

Database storage uses a sample rate of `0.115` USD/GB-month. Cost model:
`quantity × hours × instance rate` plus `storage GB × storage rate`. The engine
profile is informational. Excluded: backups, snapshots, Multi-AZ duplication,
provisioned I/O, data transfer, and commercial-engine licensing.

### Outbound data transfer

A flat sample rate of `0.09` USD/GB for internet egress. Cost model:
`outbound GB × per-GB rate`. Real AWS transfer pricing is tiered and depends on
destination and service; inbound and in-region transfer are excluded.

## What is intentionally excluded

Free-tier credits, taxes, Savings Plans / Reserved Instance discounts, load
balancers, NAT gateways, CloudWatch monitoring, support plans, and any service
not listed above. This tool estimates a simplified subset to build intuition,
not to reproduce an AWS invoice.

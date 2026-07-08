export const EC2_RATES = Object.freeze({
  't3.nano': 0.0052,
  't3.micro': 0.0104,
  't3.small': 0.0209,
  't3.medium': 0.0418,
  't3.large': 0.0835,
});

export const STORAGE_RATES = Object.freeze({
  'EBS gp3': 0.08,
  'EBS gp2': 0.10,
});

export const DEFAULTS = Object.freeze({
  ec2Instance: 't3.micro',
  ec2Hours: 730,
  ec2Rate: EC2_RATES['t3.micro'],
  storageType: 'EBS gp3',
  storageGb: 30,
  storageRate: STORAGE_RATES['EBS gp3'],
  budget: 15,
});

export const PRICING_NOTES = Object.freeze({
  region: 'US East (N. Virginia) / us-east-1',
  operatingSystem: 'Linux/Unix',
  currency: 'USD',
  monthLength: '730 hours for a rough always-on month',
  disclaimer:
    'This is a learning/demo estimator, not an official quote. Real AWS bills vary by region, OS, taxes, free tier, data transfer, snapshots, load balancers, CPU credits, and other services.',
});

# Security Specification

## Data Invariants
- `orders`: Must be created and updated with valid strings and numbers. Requires user to be signed in.
- `abandonedOrders`: Requires user to be signed in.
- `campaignRecords`: Requires user to be signed in.
- `campaignFields`: Requires user to be signed in.

## Payloads
- TBD

## Rules
- Allow read/write if signed in.

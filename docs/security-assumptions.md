# Security Assumptions

- Every trip-scoped read and mutation must resolve an active membership for the requested trip.
- Owner-only operations are checked server-side and are never enforced only by UI visibility.
- Invite tokens are random bearer secrets. Only SHA-256 token hashes are stored; raw tokens are returned once and are not logged.
- Invite joining is rate-limited by client address. Invite creation is rate-limited by owner and trip.
- The current rate limiter is in-process and suitable for the current single-instance deployment. A shared store is required before horizontal scaling.
- Guest cookies are HTTP-only, scoped to the trip path namespace, and use `SameSite=Lax`.
- Realtime connections re-check active membership before opening and are scoped to one trip ID.
- API error responses intentionally avoid revealing whether unrelated trip IDs or objects exist.

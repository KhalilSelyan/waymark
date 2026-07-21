# Realtime Event Contract

## Ownership

The server is authoritative for trip membership, canvas objects, object versions, and stream versions. Clients may optimistically render local changes, but a change is accepted only after the server validates the active trip membership and expected object version.

## Event Envelope

Every event has:

- `protocolVersion`: currently `1`.
- `eventId`: globally unique event UUID.
- `clientMessageId`: optional idempotency key supplied by the sender.
- `tripId`: the authorization and broadcast boundary.
- `actorMemberId`: the active trip member who caused the event.
- `occurredAt`: server-issued timestamp.
- `streamVersion`: monotonically increasing version for the trip stream.

Typed schemas live in `packages/api/src/realtime.ts`.

## Events

- `canvas.object.created`: new object data and version `1`.
- `canvas.object.updated`: replacement object data and expected/current version.
- `canvas.object.deleted`: soft-delete tombstone and version.
- `canvas.object.moved`: geometry position update.
- `canvas.object.reordered`: z-order update.
- `presence.joined`: member display metadata, never persisted as a canvas object.
- `presence.left`: disconnect, timeout, or removal reason.
- `presence.cursor.updated`: ephemeral cursor coordinates; never persisted.

Unsupported event or shape types are rejected with `unsupported` and must not mutate local authoritative state. Clients should retain unknown data when possible and request a fresh snapshot when they cannot render it.

## Idempotency and Stale Events

- Duplicate `clientMessageId` values must return the original acknowledgement and must not apply a mutation twice.
- An object mutation with an outdated object version is rejected as `stale`.
- Events with an already-applied or older `streamVersion` are ignored by clients.
- A stream-version gap causes the client to request a snapshot or missing incremental range before applying later events.
- Cursor and presence events may be dropped when stale; they do not require database writes.

## Join and Reconnect

1. The client authenticates and proves active membership for the trip.
2. The server returns a snapshot containing active canvas objects, current stream version, and ephemeral presence.
3. The client applies incremental events newer than that snapshot.
4. If the client reconnects with a known stream version, the server may return the incremental range. If history is unavailable or the gap is too large, it returns a fresh snapshot.

## Authorization

- Every trip-scoped event is authorized against the current active membership before broadcast or mutation.
- Removed members cannot publish, receive, or replay trip events.
- A client may only publish events with its own authenticated member identity.
- Guests use the same trip boundary and permissions as their active guest membership.
- Presence and cursor data are visible only to active members of the same trip.

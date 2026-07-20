# Waymark Domain Model

This document defines the product and data invariants for the Waymark MVP.

## Users

- Authenticated users have accounts managed by Better Auth.
- Guests do not need accounts.
- Guests receive a persistent browser-based guest token scoped to a trip.
- Guests choose a display name when joining.
- Reopening the invite in the same browser preserves the guest identity.

## Trips

- Each trip has exactly one owner.
- Ownership transfer is out of scope for the MVP.
- A trip has a name, destination, start date, end date, timezone, and one currency.
- Normal members can edit shared trip content.
- The owner controls trip settings, member removal, invite links, and trip deletion.
- Deleting a trip permanently deletes its associated data.

## Invitations

- Invite links are reusable until revoked.
- Invite links are scoped to one trip.
- Invite links can be revoked by the trip owner.
- Raw invite secrets should not be stored directly.
- A guest invite grants access only to the referenced trip.

## Shared Planning

Trip members can edit:

- Canvas objects
- Images
- Places
- Activities
- Itinerary items
- Shared notes
- Expenses

The canvas supports generic drawing objects and Waymark-specific objects:

- Text
- Sticky notes
- Shapes
- Arrows and connectors
- Freehand drawings
- Images
- Places
- Activities
- Bookings
- Expense references

Canvas state is persisted in the database. Realtime events synchronize clients temporarily; the database remains authoritative.

## Expenses

- Each trip uses one currency in the MVP.
- Money is stored as integer minor units, such as cents.
- An expense contains a description, amount, payer, participants, split details, and date.
- Equal and custom amount splits are supported.
- Balances are calculated from active expenses.
- Settlement suggestions are calculated but payments are not executed by Waymark.
- Suggested settlements can be marked as settled.

## Activity History

- Activity history is append-only in the MVP.
- Important actions create activity events.
- Events contain an actor, trip, event type, timestamp, and versioned payload.
- History entries cannot be edited or deleted in the MVP.

## State Ownership

Persistent database state:

- Users
- Trips
- Membership
- Invites
- Canvas objects
- Places
- Itinerary items
- Expenses
- Settlements
- Activity history

Ephemeral realtime state:

- Presence
- Live synchronization events
- Connection state
- Temporary acknowledgements

## Initial Entity Map

```text
User
 └── Trip ownership and membership
      ├── Invite links
      ├── Canvas objects
      ├── Places
      ├── Itinerary items
      ├── Expenses and shares
      ├── Settlement records
      └── Activity events
```

The database schema and API should follow this document. If an implementation needs to change one of these invariants, update this document in the same pull request.

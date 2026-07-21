import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const userProfiles = pgTable(
  "user_profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_profile_username_idx").on(table.username),
    check(
      "user_profile_username_length_check",
      sql`char_length(${table.username}) between 3 and 24`,
    ),
  ],
);

export const trips = pgTable(
  "trip",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    destination: text("destination"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    timezone: text("timezone").notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("trip_owner_user_id_idx").on(table.ownerUserId),
    index("trip_deleted_at_idx").on(table.deletedAt),
    check(
      "trip_dates_check",
      sql`${table.endsOn} is null or ${table.startsOn} is null or ${table.endsOn} >= ${table.startsOn}`,
    ),
    check("trip_currency_check", sql`char_length(${table.currency}) = 3`),
  ],
);

export const tripGuests = pgTable(
  "trip_guest",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    guestTokenHash: text("guest_token_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("trip_guest_token_hash_idx").on(table.guestTokenHash),
    uniqueIndex("trip_guest_trip_username_idx").on(table.tripId, table.username),
    index("trip_guest_trip_id_idx").on(table.tripId),
  ],
);

export const tripMembers = pgTable(
  "trip_member",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id").references(() => tripGuests.id, {
      onDelete: "cascade",
    }),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["owner", "member"] })
      .notNull()
      .default("member"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at"),
    removedAt: timestamp("removed_at"),
  },
  (table) => [
    index("trip_member_trip_id_idx").on(table.tripId),
    index("trip_member_user_id_idx").on(table.userId),
    index("trip_member_guest_id_idx").on(table.guestId),
    index("trip_member_active_trip_idx").on(table.tripId, table.removedAt),
    uniqueIndex("trip_member_trip_user_idx").on(table.tripId, table.userId),
    uniqueIndex("trip_member_trip_guest_idx").on(table.tripId, table.guestId),
    check(
      "trip_member_identity_check",
      sql`(${table.userId} is not null and ${table.guestId} is null) or (${table.userId} is null and ${table.guestId} is not null)`,
    ),
  ],
);

export const tripInvites = pgTable(
  "trip_invite",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    uniqueIndex("trip_invite_token_hash_idx").on(table.tokenHash),
    index("trip_invite_trip_id_idx").on(table.tripId),
  ],
);

export const assets = pgTable(
  "asset",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    uploadedByMemberId: uuid("uploaded_by_member_id")
      .notNull()
      .references(() => tripMembers.id, { onDelete: "restrict" }),
    type: text("type", { enum: ["image", "webpage_screenshot"] }).notNull(),
    storageKey: text("storage_key").notNull(),
    sourceUrl: text("source_url"),
    title: text("title"),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    byteSize: integer("byte_size"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("asset_storage_key_idx").on(table.storageKey),
    index("asset_trip_id_idx").on(table.tripId),
  ],
);

export const canvasObjects = pgTable(
  "canvas_object",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    createdByMemberId: uuid("created_by_member_id")
      .notNull()
      .references(() => tripMembers.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    x: real("x").notNull(),
    y: real("y").notNull(),
    width: real("width"),
    height: real("height"),
    rotation: real("rotation").notNull().default(0),
    zIndex: integer("z_index").notNull().default(0),
    data: jsonb("data").notNull().default({}),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("canvas_object_trip_id_idx").on(table.tripId),
    index("canvas_object_trip_active_idx").on(table.tripId, table.deletedAt),
  ],
);

export const places = pgTable(
  "place",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    createdByMemberId: uuid("created_by_member_id")
      .notNull()
      .references(() => tripMembers.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    address: text("address"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    mapUrl: text("map_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [index("place_trip_id_idx").on(table.tripId)],
);

export const itineraryItems = pgTable(
  "itinerary_item",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    createdByMemberId: uuid("created_by_member_id")
      .notNull()
      .references(() => tripMembers.id, { onDelete: "restrict" }),
    placeId: uuid("place_id").references(() => places.id, {
      onDelete: "set null",
    }),
    sourceCanvasObjectId: uuid("source_canvas_object_id").references(
      () => canvasObjects.id,
      { onDelete: "set null" },
    ),
    day: date("day").notNull(),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    notes: text("notes"),
    status: text("status", { enum: ["idea", "planned", "done"] })
      .notNull()
      .default("planned"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("itinerary_item_trip_day_idx").on(table.tripId, table.day),
    index("itinerary_item_place_id_idx").on(table.placeId),
    check(
      "itinerary_item_time_check",
      sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.endsAt} >= ${table.startsAt}`,
    ),
  ],
);

export const expenses = pgTable(
  "expense",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    createdByMemberId: uuid("created_by_member_id")
      .notNull()
      .references(() => tripMembers.id, { onDelete: "restrict" }),
    payerMemberId: uuid("payer_member_id")
      .notNull()
      .references(() => tripMembers.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("expense_trip_id_idx").on(table.tripId),
    index("expense_payer_member_id_idx").on(table.payerMemberId),
    check("expense_amount_check", sql`${table.amountMinor} > 0`),
    check("expense_currency_check", sql`char_length(${table.currency}) = 3`),
  ],
);

export const expenseShares = pgTable(
  "expense_share",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => tripMembers.id, { onDelete: "restrict" }),
    amountMinor: integer("amount_minor").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.expenseId, table.memberId] }),
    check("expense_share_amount_check", sql`${table.amountMinor} >= 0`),
  ],
);

export const settlements = pgTable(
  "settlement",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    fromMemberId: uuid("from_member_id")
      .notNull()
      .references(() => tripMembers.id, { onDelete: "restrict" }),
    toMemberId: uuid("to_member_id")
      .notNull()
      .references(() => tripMembers.id, { onDelete: "restrict" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: text("status", { enum: ["suggested", "settled"] })
      .notNull()
      .default("suggested"),
    markedSettledAt: timestamp("marked_settled_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("settlement_trip_id_idx").on(table.tripId),
    check("settlement_members_check", sql`${table.fromMemberId} <> ${table.toMemberId}`),
    check("settlement_amount_check", sql`${table.amountMinor} > 0`),
    check("settlement_currency_check", sql`char_length(${table.currency}) = 3`),
  ],
);

export const activityEvents = pgTable(
  "activity_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    actorMemberId: uuid("actor_member_id")
      .notNull()
      .references(() => tripMembers.id, { onDelete: "restrict" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("activity_event_trip_created_idx").on(table.tripId, table.createdAt),
  ],
);

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(user, {
    fields: [userProfiles.userId],
    references: [user.id],
  }),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  owner: one(user, {
    fields: [trips.ownerUserId],
    references: [user.id],
  }),
  members: many(tripMembers),
  guests: many(tripGuests),
  invites: many(tripInvites),
  assets: many(assets),
  canvasObjects: many(canvasObjects),
  places: many(places),
  itineraryItems: many(itineraryItems),
  expenses: many(expenses),
  settlements: many(settlements),
  activityEvents: many(activityEvents),
}));

export const tripGuestsRelations = relations(tripGuests, ({ many, one }) => ({
  memberships: many(tripMembers),
  trip: one(trips, { fields: [tripGuests.tripId], references: [trips.id] }),
}));

export const tripMembersRelations = relations(tripMembers, ({ one, many }) => ({
  trip: one(trips, {
    fields: [tripMembers.tripId],
    references: [trips.id],
  }),
  user: one(user, {
    fields: [tripMembers.userId],
    references: [user.id],
  }),
  guest: one(tripGuests, {
    fields: [tripMembers.guestId],
    references: [tripGuests.id],
  }),
  createdCanvasObjects: many(canvasObjects),
  createdPlaces: many(places),
  createdItineraryItems: many(itineraryItems),
  createdExpenses: many(expenses),
  expenseShares: many(expenseShares),
  payerExpenses: many(expenses),
  outgoingSettlements: many(settlements),
  incomingSettlements: many(settlements),
  activityEvents: many(activityEvents),
}));

export const tripInvitesRelations = relations(tripInvites, ({ one }) => ({
  trip: one(trips, {
    fields: [tripInvites.tripId],
    references: [trips.id],
  }),
  createdBy: one(user, {
    fields: [tripInvites.createdByUserId],
    references: [user.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  trip: one(trips, { fields: [assets.tripId], references: [trips.id] }),
  uploadedBy: one(tripMembers, {
    fields: [assets.uploadedByMemberId],
    references: [tripMembers.id],
  }),
}));

export const canvasObjectsRelations = relations(canvasObjects, ({ one }) => ({
  trip: one(trips, { fields: [canvasObjects.tripId], references: [trips.id] }),
  createdBy: one(tripMembers, {
    fields: [canvasObjects.createdByMemberId],
    references: [tripMembers.id],
  }),
}));

export const placesRelations = relations(places, ({ one, many }) => ({
  trip: one(trips, { fields: [places.tripId], references: [trips.id] }),
  createdBy: one(tripMembers, {
    fields: [places.createdByMemberId],
    references: [tripMembers.id],
  }),
  itineraryItems: many(itineraryItems),
}));

export const itineraryItemsRelations = relations(itineraryItems, ({ one }) => ({
  trip: one(trips, {
    fields: [itineraryItems.tripId],
    references: [trips.id],
  }),
  createdBy: one(tripMembers, {
    fields: [itineraryItems.createdByMemberId],
    references: [tripMembers.id],
  }),
  place: one(places, {
    fields: [itineraryItems.placeId],
    references: [places.id],
  }),
  sourceCanvasObject: one(canvasObjects, {
    fields: [itineraryItems.sourceCanvasObjectId],
    references: [canvasObjects.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  trip: one(trips, { fields: [expenses.tripId], references: [trips.id] }),
  createdBy: one(tripMembers, {
    fields: [expenses.createdByMemberId],
    references: [tripMembers.id],
  }),
  payer: one(tripMembers, {
    fields: [expenses.payerMemberId],
    references: [tripMembers.id],
  }),
  shares: many(expenseShares),
}));

export const expenseSharesRelations = relations(expenseShares, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseShares.expenseId],
    references: [expenses.id],
  }),
  member: one(tripMembers, {
    fields: [expenseShares.memberId],
    references: [tripMembers.id],
  }),
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
  trip: one(trips, {
    fields: [settlements.tripId],
    references: [trips.id],
  }),
  fromMember: one(tripMembers, {
    fields: [settlements.fromMemberId],
    references: [tripMembers.id],
  }),
  toMember: one(tripMembers, {
    fields: [settlements.toMemberId],
    references: [tripMembers.id],
  }),
}));

export const activityEventsRelations = relations(activityEvents, ({ one }) => ({
  trip: one(trips, {
    fields: [activityEvents.tripId],
    references: [trips.id],
  }),
  actor: one(tripMembers, {
    fields: [activityEvents.actorMemberId],
    references: [tripMembers.id],
  }),
}));

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Lead table schema
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name"),
  phoneNumber: text("phone_number").notNull(),
  productCategory: text("product_category").notNull(),
  brandName: text("brand_name").notNull(),
  source: text("source").default("web_widget"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Call session states
export const callStates = ["INTRO", "DIALING", "COMPLETED", "FAILED"] as const;

// Call session table schema
export const callSessions = pgTable("call_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  phoneNumber: text("phone_number").notNull(),
  businessName: text("business_name").notNull(),
  productCategory: text("product_category").notNull(),
  brandName: text("brand_name").notNull(),
  state: text("state").notNull().default("INTRO"),
  transcript: text("transcript").array().default(sql`ARRAY[]::text[]`),
  captured: text("captured"),
  twilioSid: text("twilio_sid"),
  twilioStatus: text("twilio_status"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas with validation
export const insertLeadSchema = createInsertSchema(leads, {
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format (e.g., +12345678900)"),
  businessName: z.string().min(1, "Business name is required"),
  productCategory: z.string().min(1, "Product category is required"),
  brandName: z.string().min(1, "Brand name is required"),
}).omit({ id: true, createdAt: true, source: true });

export const insertCallSessionSchema = createInsertSchema(callSessions, {
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format"),
  state: z.enum(callStates),
}).omit({ id: true, createdAt: true, updatedAt: true });

// TypeScript types
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type CallState = typeof callStates[number];
export type InsertCallSession = z.infer<typeof insertCallSessionSchema>;
export type CallSession = typeof callSessions.$inferSelect;

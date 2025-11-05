import { type Lead, type InsertLead, type CallSession, type InsertCallSession } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Lead operations
  createLead(lead: InsertLead): Promise<Lead>;
  getLead(id: string): Promise<Lead | undefined>;
  getAllLeads(): Promise<Lead[]>;
  
  // CallSession operations
  createCallSession(session: InsertCallSession): Promise<CallSession>;
  getCallSession(id: string): Promise<CallSession | undefined>;
  getAllCallSessions(): Promise<CallSession[]>;
  updateCallSession(id: string, updates: Partial<CallSession>): Promise<CallSession | undefined>;
  
  // Rate limiting helper
  getRecentCallByPhone(phoneNumber: string, withinMinutes: number): Promise<CallSession | undefined>;
}

export class MemStorage implements IStorage {
  private leads: Map<string, Lead>;
  private callSessions: Map<string, CallSession>;

  constructor() {
    this.leads = new Map();
    this.callSessions = new Map();
  }

  // Lead operations
  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const lead: Lead = {
      ...insertLead,
      id,
      createdAt: new Date(),
      source: "web_widget",
    };
    this.leads.set(id, lead);
    return lead;
  }

  async getLead(id: string): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async getAllLeads(): Promise<Lead[]> {
    return Array.from(this.leads.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  // CallSession operations
  async createCallSession(insertSession: InsertCallSession): Promise<CallSession> {
    const id = randomUUID();
    const now = new Date();
    const session: CallSession = {
      ...insertSession,
      id,
      transcript: [],
      captured: null,
      twilioSid: null,
      twilioStatus: null,
      createdAt: now,
      updatedAt: now,
    };
    this.callSessions.set(id, session);
    return session;
  }

  async getCallSession(id: string): Promise<CallSession | undefined> {
    return this.callSessions.get(id);
  }

  async getAllCallSessions(): Promise<CallSession[]> {
    return Array.from(this.callSessions.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateCallSession(id: string, updates: Partial<CallSession>): Promise<CallSession | undefined> {
    const session = this.callSessions.get(id);
    if (!session) return undefined;

    const updated: CallSession = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };
    this.callSessions.set(id, updated);
    return updated;
  }

  async getRecentCallByPhone(phoneNumber: string, withinMinutes: number): Promise<CallSession | undefined> {
    const cutoffTime = new Date(Date.now() - withinMinutes * 60 * 1000);
    return Array.from(this.callSessions.values()).find(
      (session) =>
        session.phoneNumber === phoneNumber &&
        session.createdAt >= cutoffTime
    );
  }
}

export const storage = new MemStorage();

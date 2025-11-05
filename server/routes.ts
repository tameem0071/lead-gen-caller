import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertCallSessionSchema } from "@shared/schema";
import { getTwilioClient, getTwilioFromPhoneNumber, generateTwiML } from "./twilio";

export async function registerRoutes(app: Express): Promise<Server> {
  // POST /api/leads - Create a new lead and optionally trigger call
  app.post("/api/leads", async (req, res) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(validatedData);
      
      let callStatus: "success" | "rate_limited" | "failed" = "success";
      let callError: string | undefined;

      // Auto-trigger call workflow
      try {
        // Rate limiting check - prevent duplicate calls within 1 minute
        const recentCall = await storage.getRecentCallByPhone(lead.phoneNumber, 1);
        if (recentCall) {
          console.log(`Rate limit: Skipping auto-call for ${lead.phoneNumber} (called recently)`);
          callStatus = "rate_limited";
          callError = "Please wait 60 seconds before calling this number again";
          return res.json({ 
            ...lead, 
            callStatus,
            callError 
          });
        }

        // Create call session
        const callSession = await storage.createCallSession({
          leadId: lead.id,
          phoneNumber: lead.phoneNumber,
          businessName: lead.businessName,
          productCategory: lead.productCategory,
          brandName: lead.brandName,
          state: "INTRO",
        });

        // Immediately dial
        const twilioClient = await getTwilioClient();
        const fromNumber = await getTwilioFromPhoneNumber();
        const twiml = generateTwiML(lead.businessName, lead.productCategory, lead.brandName);

        // Update to DIALING state
        await storage.updateCallSession(callSession.id, { state: "DIALING" });

        const call = await twilioClient.calls.create({
          to: lead.phoneNumber,
          from: fromNumber,
          twiml: twiml,
        });

        // Update with Twilio info
        await storage.updateCallSession(callSession.id, {
          twilioSid: call.sid,
          twilioStatus: call.status,
          state: "DIALING",
        });

        console.log(`Call initiated for lead ${lead.id}, call SID: ${call.sid}`);
      } catch (twilioError: any) {
        console.error("Failed to auto-trigger call:", twilioError);
        
        callStatus = "failed";
        
        // Update call session to FAILED state if it was created
        const sessions = await storage.getAllCallSessions();
        const failedSession = sessions.find(s => s.leadId === lead.id && !s.twilioSid);
        if (failedSession) {
          await storage.updateCallSession(failedSession.id, { state: "FAILED" });
        }
        
        // Provide trial-friendly error messages
        if (twilioError.code === 21608) {
          console.error("Twilio trial mode: Number not verified");
          callError = "Trial mode: This number is not verified in your Twilio account. Please verify the number to receive calls.";
        } else {
          callError = twilioError.message || "Failed to place call. Please try again or contact support.";
        }
      }

      res.json({ 
        ...lead, 
        callStatus,
        callError 
      });
    } catch (error: any) {
      console.error("Lead creation error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: error.message || "Failed to create lead" 
      });
    }
  });

  // GET /api/leads - Get all leads
  app.get("/api/leads", async (_req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error: any) {
      console.error("Get leads error:", error);
      res.status(500).json({ 
        message: error.message || "Failed to get leads" 
      });
    }
  });

  // POST /api/call/start - Create a call session
  app.post("/api/call/start", async (req, res) => {
    try {
      const { leadId, phoneNumber, businessName, productCategory, brandName } = req.body;

      if (!leadId || !phoneNumber || !businessName || !productCategory || !brandName) {
        return res.status(400).json({ 
          message: "Missing required fields" 
        });
      }

      // Rate limiting check - prevent duplicate calls within 1 minute
      const recentCall = await storage.getRecentCallByPhone(phoneNumber, 1);
      if (recentCall) {
        return res.status(429).json({ 
          message: "Please wait 60 seconds before calling this lead again" 
        });
      }

      const callSession = await storage.createCallSession({
        leadId,
        phoneNumber,
        businessName,
        productCategory,
        brandName,
        state: "INTRO",
      });

      res.json(callSession);
    } catch (error: any) {
      console.error("Call session creation error:", error);
      res.status(500).json({ 
        message: error.message || "Failed to create call session" 
      });
    }
  });

  // POST /api/call/:callId/dial - Dial the call using Twilio
  app.post("/api/call/:callId/dial", async (req, res) => {
    try {
      const { callId } = req.params;
      const session = await storage.getCallSession(callId);

      if (!session) {
        return res.status(404).json({ message: "Call session not found" });
      }

      // Update to DIALING state
      await storage.updateCallSession(callId, { state: "DIALING" });

      const twilioClient = await getTwilioClient();
      const fromNumber = await getTwilioFromPhoneNumber();
      const twiml = generateTwiML(
        session.businessName,
        session.productCategory,
        session.brandName
      );

      const call = await twilioClient.calls.create({
        to: session.phoneNumber,
        from: fromNumber,
        twiml: twiml,
      });

      // Update session with Twilio info
      const updated = await storage.updateCallSession(callId, {
        twilioSid: call.sid,
        twilioStatus: call.status,
        state: call.status === "failed" ? "FAILED" : "DIALING",
      });

      console.log(`Call placed: ${call.sid} to ${session.phoneNumber}`);
      
      res.json(updated);
    } catch (error: any) {
      console.error("Dial error:", error);
      
      // Update session to FAILED state
      const { callId } = req.params;
      await storage.updateCallSession(callId, { state: "FAILED" });

      // Check for Twilio-specific errors
      if (error.code === 21608) {
        return res.status(400).json({ 
          message: "Trial mode: This number is not verified. Please verify the number in your Twilio console." 
        });
      }

      res.status(500).json({ 
        message: error.message || "Failed to place call" 
      });
    }
  });

  // GET /api/call/:id/status - Get call session status
  app.get("/api/call/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getCallSession(id);

      if (!session) {
        return res.status(404).json({ message: "Call session not found" });
      }

      // If we have a Twilio SID, fetch updated status
      if (session.twilioSid) {
        try {
          const twilioClient = await getTwilioClient();
          const call = await twilioClient.calls(session.twilioSid).fetch();
          
          // Update local state based on Twilio status
          let newState = session.state;
          if (call.status === "completed") {
            newState = "COMPLETED";
          } else if (call.status === "failed" || call.status === "canceled" || call.status === "busy" || call.status === "no-answer") {
            newState = "FAILED";
          }

          if (newState !== session.state) {
            await storage.updateCallSession(id, {
              state: newState,
              twilioStatus: call.status,
            });
            session.state = newState;
            session.twilioStatus = call.status;
          }
        } catch (twilioError) {
          console.error("Failed to fetch Twilio call status:", twilioError);
        }
      }

      res.json(session);
    } catch (error: any) {
      console.error("Get call status error:", error);
      res.status(500).json({ 
        message: error.message || "Failed to get call status" 
      });
    }
  });

  // GET /api/calls - Get all call sessions
  app.get("/api/calls", async (_req, res) => {
    try {
      const sessions = await storage.getAllCallSessions();
      res.json(sessions);
    } catch (error: any) {
      console.error("Get calls error:", error);
      res.status(500).json({ 
        message: error.message || "Failed to get call sessions" 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

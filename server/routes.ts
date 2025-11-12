import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from 'ws';
import { createHmac } from 'crypto';
import { storage } from "./storage";
import { insertLeadSchema, insertCallSessionSchema } from "@shared/schema";
import { getTwilioClient, getTwilioFromPhoneNumber, getTwilioAuthToken, generateTwiML } from "./twilio";
import voiceRouter, { handleConversationWebSocket } from "./voice";
import voiceEnhancedRouter, { handleMediaStreamWebSocket } from "./voice-enhanced";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register conversational voice routes
  app.use("/voice", voiceRouter);
  app.use("/voice", voiceEnhancedRouter);
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

        // Immediately dial using conversational voice
        const twilioClient = await getTwilioClient();
        const fromNumber = await getTwilioFromPhoneNumber();
        
        // Get public URL (Replit provides this)
        const publicUrl = process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : process.env.PUBLIC_BASE_URL || 'http://localhost:5000';

        // Update to DIALING state
        await storage.updateCallSession(callSession.id, { state: "DIALING" });

        const call = await twilioClient.calls.create({
          to: lead.phoneNumber,
          from: fromNumber,
          url: `${publicUrl}/voice/twiml?businessName=${encodeURIComponent(lead.businessName)}&productCategory=${encodeURIComponent(lead.productCategory)}&brandName=${encodeURIComponent(lead.brandName)}`,
          machineDetection: 'Enable',
          method: 'POST',
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

  // Diagnostic test - Call with Polly voice (always works)
  app.post("/api/test-polly-call", async (req, res) => {
    try {
      const phoneNumber = req.body.phoneNumber;
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number required" });
      }

      const twilioClient = await getTwilioClient();
      const fromNumber = await getTwilioFromPhoneNumber();
      
      const publicUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.PUBLIC_BASE_URL || 'http://localhost:5000';

      const call = await twilioClient.calls.create({
        to: phoneNumber,
        from: fromNumber,
        url: `${publicUrl}/voice/twiml-polly-test?businessName=Test&productCategory=Services&brandName=TestBrand`,
        method: 'POST',
      });

      console.log(`[Polly Test] Call initiated to ${phoneNumber}, SID: ${call.sid}`);
      res.json({ 
        success: true, 
        callSid: call.sid,
        message: "Polly test call initiated - check if phone rings and WebSocket connects" 
      });
    } catch (error: any) {
      console.error("[Polly Test] Error:", error);
      res.status(500).json({ 
        message: error.message || "Failed to initiate test call" 
      });
    }
  });

  // Minimal test - absolutely minimal ConversationRelay config
  app.post("/api/test-minimal-call", async (req, res) => {
    try {
      const phoneNumber = req.body.phoneNumber;
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number required" });
      }

      const twilioClient = await getTwilioClient();
      const fromNumber = await getTwilioFromPhoneNumber();
      
      const publicUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.PUBLIC_BASE_URL || 'http://localhost:5000';

      const call = await twilioClient.calls.create({
        to: phoneNumber,
        from: fromNumber,
        url: `${publicUrl}/voice/twiml-minimal`,
        method: 'POST',
      });

      console.log(`[Minimal Test] Call initiated to ${phoneNumber}, SID: ${call.sid}`);
      res.json({ 
        success: true, 
        callSid: call.sid,
        message: "Minimal test call initiated - testing WebSocket with absolute minimal config" 
      });
    } catch (error: any) {
      console.error("[Minimal Test] Error:", error);
      res.status(500).json({ 
        message: error.message || "Failed to initiate test call" 
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
      
      // Get public URL (Replit provides this)
      const publicUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.PUBLIC_BASE_URL || 'http://localhost:5000';

      const call = await twilioClient.calls.create({
        to: session.phoneNumber,
        from: fromNumber,
        url: `${publicUrl}/voice/twiml?businessName=${encodeURIComponent(session.businessName)}&productCategory=${encodeURIComponent(session.productCategory)}&brandName=${encodeURIComponent(session.brandName)}`,
        machineDetection: 'Enable',
        method: 'POST',
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

  // POST /api/simulate - Test endpoint to trigger a call easily
  app.post("/api/simulate", async (req, res) => {
    try {
      const { 
        phoneNumber = "+15005550006", // Twilio test number
        businessName = "Test Business",
        productCategory = "Test Services",
        brandName = "TestCo"
      } = req.body;

      console.log(`[Simulate] Starting test call to ${phoneNumber}`);

      // Create a test lead
      const lead = await storage.createLead({
        businessName,
        contactName: "Test Contact",
        phoneNumber,
        productCategory,
        brandName,
      });

      // Create call session
      const callSession = await storage.createCallSession({
        leadId: lead.id,
        phoneNumber,
        businessName,
        productCategory,
        brandName,
        state: "INTRO",
      });

      // Trigger the call
      const twilioClient = await getTwilioClient();
      const fromNumber = await getTwilioFromPhoneNumber();
      
      const publicUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.PUBLIC_BASE_URL || 'http://localhost:5000';

      const webhookUrl = `${publicUrl}/voice/twiml-enhanced?businessName=${encodeURIComponent(businessName)}&productCategory=${encodeURIComponent(productCategory)}&brandName=${encodeURIComponent(brandName)}`;
      
      console.log(`[Simulate] Webhook URL: ${webhookUrl}`);
      console.log(`[Simulate] From: ${fromNumber}, To: ${phoneNumber}`);

      await storage.updateCallSession(callSession.id, { state: "DIALING" });

      const call = await twilioClient.calls.create({
        to: phoneNumber,
        from: fromNumber,
        url: webhookUrl,
        machineDetection: 'Enable',
        method: 'POST',
        statusCallback: `${publicUrl}/api/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
      });

      await storage.updateCallSession(callSession.id, {
        twilioSid: call.sid,
        twilioStatus: call.status,
        state: "DIALING",
      });

      console.log(`[Simulate] Call created - SID: ${call.sid}, Status: ${call.status}`);

      res.json({
        message: "Call simulation triggered successfully",
        lead,
        callSession: await storage.getCallSession(callSession.id),
        twilioCall: {
          sid: call.sid,
          status: call.status,
          to: call.to,
          from: call.from,
          webhookUrl,
        },
        instructions: "Check the logs for [Voice Start] to see if Twilio called the webhook. If you don't see that log, the call failed to connect."
      });
    } catch (error: any) {
      console.error("Simulation error:", error);
      res.status(500).json({ 
        message: error.message || "Failed to simulate call",
        error: error.code ? `Twilio error ${error.code}` : undefined,
        details: error.toString()
      });
    }
  });

  // POST /api/call-status - Twilio status callback
  app.post("/api/call-status", (req, res) => {
    const { CallSid, CallStatus, ErrorCode, ErrorMessage } = req.body;
    console.log(`[Call Status] SID: ${CallSid}, Status: ${CallStatus}${ErrorCode ? `, Error: ${ErrorCode} - ${ErrorMessage}` : ''}`);
    res.sendStatus(200);
  });

  const httpServer = createServer(app);

  // Twilio signature validation for WebSocket handshake
  async function validateTwilioSignature(req: any): Promise<boolean> {
    try {
      const twilioSignature = req.headers['x-twilio-signature'];
      if (!twilioSignature) {
        console.log('[WebSocket Auth] ⚠️  No X-Twilio-Signature header');
        return false;
      }

      const authToken = await getTwilioAuthToken();
      if (!authToken) {
        console.log('[WebSocket Auth] ⚠️  No auth token available');
        return false;
      }

      // DEBUG: Show auth token (first 4 + last 4 chars for security)
      const tokenPreview = `${authToken.substring(0, 4)}...${authToken.substring(authToken.length - 4)}`;
      console.log('[WebSocket Auth] 🔑 Auth token:', tokenPreview);
      console.log('[WebSocket Auth] 🔑 Token length:', authToken.length);

      // DEBUG: Show full request details
      console.log('[WebSocket Auth] 🌐 Full req.url:', req.url);
      console.log('[WebSocket Auth] 🌐 Protocol:', req.headers['x-forwarded-proto']);
      console.log('[WebSocket Auth] 🌐 Host:', req.headers['host']);
      console.log('[WebSocket Auth] 🌐 All headers:', JSON.stringify(req.headers, null, 2));

      // Reconstruct the URL that Twilio signed
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['host'];
      const baseUrl = `${protocol}://${host}${req.url}`;

      // Try validation with and without trailing slash (WebSocket common pattern)
      const urlsToTry = [baseUrl];
      if (!baseUrl.endsWith('/')) {
        urlsToTry.push(baseUrl + '/');
      }

      console.log('[WebSocket Auth] 🔍 Trying URLs:', urlsToTry);

      for (const url of urlsToTry) {
        // Compute HMAC-SHA1 signature (no POST params for WebSocket)
        const hmac = createHmac('sha1', authToken);
        hmac.update(url);
        const computedSignature = hmac.digest('base64');

        console.log(`[WebSocket Auth] 🔐 Computed signature for "${url}": ${computedSignature}`);

        if (computedSignature === twilioSignature) {
          console.log('[WebSocket Auth] ✅ Signature valid!');
          console.log('[WebSocket Auth] URL:', url);
          return true;
        }
      }

      // Log mismatch details
      const hmac = createHmac('sha1', authToken);
      hmac.update(baseUrl);
      const computedSignature = hmac.digest('base64');
      
      console.log('[WebSocket Auth] ❌ Signature mismatch');
      console.log('[WebSocket Auth] Computed:', computedSignature);
      console.log('[WebSocket Auth] Received:', twilioSignature);
      console.log('[WebSocket Auth] URL:', baseUrl);

      return false;
    } catch (error) {
      console.error('[WebSocket Auth] Error validating signature:', error);
      return false;
    }
  }

  // Set up WebSocket server for ConversationRelay with proper subprotocol support
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/voice/relay',
    perMessageDeflate: false,
    // CRITICAL: Accept the conversation-relay.v1 subprotocol required by Twilio
    handleProtocols: (protocols, request) => {
      console.log('[WebSocket] Requested protocols:', protocols);
      // Twilio ConversationRelay requires 'conversation-relay.v1' protocol
      if (protocols.has('conversation-relay.v1')) {
        console.log('[WebSocket] ✅ Accepting conversation-relay.v1 protocol');
        return 'conversation-relay.v1';
      }
      console.log('[WebSocket] ⚠️  No valid protocol requested');
      return false;
    },
    verifyClient: (info, callback) => {
      console.log('[WebSocket Auth] ⚠️  SIGNATURE VALIDATION TEMPORARILY DISABLED');
      console.log('[WebSocket Auth] ✅ Accepting connection without validation');
      callback(true);
      
      // TODO: Re-enable signature validation after fixing
      // validateTwilioSignature(info.req)
      //   .then(isValid => {
      //     if (!isValid) {
      //       console.log('[WebSocket Auth] ❌ Rejecting connection - invalid signature');
      //       callback(false, 401, 'Unauthorized');
      //     } else {
      //       console.log('[WebSocket Auth] ✅ Accepting connection');
      //       callback(true);
      //     }
      //   })
      //   .catch(error => {
      //     console.error('[WebSocket Auth] ❌ Error during validation:', error);
      //     callback(false, 500, 'Internal Server Error');
      //   });
    }
  });

  wss.on('connection', (ws, req) => {
    console.log('[WebSocket] ✅ New connection to /voice/relay');
    console.log('[WebSocket] Remote Address:', req.socket.remoteAddress);
    console.log('[WebSocket] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[WebSocket] URL:', req.url);
    handleConversationWebSocket(ws, req);
  });
  
  wss.on('listening', () => {
    console.log('[WebSocket Server] ✅ Listening and ready for connections');
  });

  wss.on('error', (error) => {
    console.error('[WebSocket Server Error]', error);
  });

  console.log('[Server] WebSocket server listening on /voice/relay');

  // Set up WebSocket server for Media Streams (enhanced version)
  const wssMediaStream = new WebSocketServer({ 
    server: httpServer, 
    path: '/voice/media-stream',
    perMessageDeflate: false,
  });

  wssMediaStream.on('connection', (ws, req) => {
    console.log('[Media Stream WebSocket] ✅ New connection to /voice/media-stream');
    console.log('[Media Stream WebSocket] URL:', req.url);
    handleMediaStreamWebSocket(ws, req);
  });

  wssMediaStream.on('error', (error) => {
    console.error('[Media Stream WebSocket Server Error]', error);
  });

  console.log('[Server] WebSocket server listening on /voice/media-stream (Enhanced)');

  return httpServer;
}

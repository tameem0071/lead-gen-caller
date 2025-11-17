import { Router } from 'express';
import type { Request, Response } from 'express';
import type { WebSocket } from 'ws';
import OpenAI from 'openai';
import { getWebSocketUrl } from './utils/hostname';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ConversationState {
  callSid: string;
  streamSid: string;
  businessName: string;
  productCategory: string;
  brandName: string;
  messages: Message[];
  turnCount: number;
  ws: WebSocket;
}

const conversations = new Map<string, ConversationState>();

const SYSTEM_PROMPT = `You're Alex, a professional calling on behalf of a company. You sound like a real person - calm, clear, and straightforward.

CRITICAL RULES:
1. Keep it SHORT - 1-2 sentences max per response. This is a phone call.
2. Sound NATURAL but PROFESSIONAL - measured tone, clear speech, no over-enthusiasm
3. NO PLACEHOLDERS - Never say [Your Name] or [Company]. Use what you know or stay general
4. Be DIRECT but polite - get to the point without being pushy
5. Match their pace - if they're busy, be brief. If engaged, provide more detail

PERSONALITY:
- You're Alex - calm, knowledgeable, respectful
- Professional but not robotic - use contractions naturally
- Minimal filler words - only "um" or "you know" if it feels natural
- Measured delivery - not overly upbeat, not monotone
- Acknowledge responses simply: "I understand", "Got it", "That makes sense"

EXAMPLES:
User: "Who is this?"
You: "This is Alex calling from TestCo. We received your inquiry about our services. Do you have a moment to talk?"

User: "How much does it cost?"
You: "Most clients are in the $500 to $1000 range per month, depending on their needs."

User: "I'm busy"
You: "[END_CALL] I understand. I'll send you an email with the details instead. Thanks for your time."

TO END CALL: Start with [END_CALL]
- "[END_CALL] Understood. I'll follow up by email. Have a good day."
- "[END_CALL] No problem. I'll reach out another time. Take care."

Remember: Professional, calm, clear. Like a knowledgeable consultant, not a salesperson.`;

async function generateAIResponse(
  state: ConversationState,
  userMessage: string
): Promise<{ message: string; shouldEndCall: boolean }> {
  state.messages.push({
    role: 'user',
    content: userMessage,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nCONTEXT: You're calling from ${state.brandName} about ${state.productCategory}. The business is ${state.businessName}. Answer questions confidently.`,
        },
        ...state.messages,
      ],
      temperature: 1.0,
      max_tokens: 100,
      stream: false,
    });

    const aiResponse =
      completion.choices[0]?.message?.content ||
      "Sorry, could you repeat that?";

    let shouldEndCall = false;
    let cleanResponse = aiResponse;

    if (aiResponse.startsWith('[END_CALL]')) {
      shouldEndCall = true;
      cleanResponse = aiResponse.replace('[END_CALL]', '').trim();
    }

    state.messages.push({
      role: 'assistant',
      content: cleanResponse,
    });

    state.turnCount++;

    console.log(
      `[AI] Turn ${state.turnCount}: "${cleanResponse}" (end: ${shouldEndCall})`
    );

    return { message: cleanResponse, shouldEndCall };
  } catch (error) {
    console.error('[AI Error]', error);
    return {
      message: "I'm having some tech issues. Let me have someone call you back.",
      shouldEndCall: true,
    };
  }
}

export function handleConversationWebSocket(ws: WebSocket, req: any) {
  console.log('[WebSocket] ✅ New ConversationRelay connection');
  console.log('[WebSocket] User-Agent:', req.headers['user-agent']);
  console.log('[WebSocket] Origin:', req.headers['origin']);
  console.log('[WebSocket] X-Twilio-Signature:', req.headers['x-twilio-signature']);
  console.log('[WebSocket] Protocol:', (ws as any).protocol);
  console.log('[WebSocket] ReadyState:', ws.readyState);

  let callSid: string = '';
  let state: ConversationState | undefined;

  const url = req.url || '';
  const urlParams = new URLSearchParams(url.split('?')[1] || '');
  const businessName = urlParams.get('businessName') || 'your business';
  const productCategory = urlParams.get('productCategory') || 'our services';
  const brandName = urlParams.get('brandName') || 'the company';

  console.log('[WebSocket] Params:', { businessName, productCategory, brandName });
  console.log('[WebSocket] ✅ Ready to receive messages from Twilio');
  
  // Keep connection alive with ping/pong
  const pingInterval = setInterval(() => {
    if (ws.readyState === 1) {
      ws.ping();
      console.log('[WebSocket] Sent ping');
    }
  }, 30000);

  ws.on('pong', () => {
    console.log('[WebSocket] Received pong');
  });

  ws.on('message', async (message: any) => {
    try {
      console.log('[WS Raw Message]', message.toString());
      const data = JSON.parse(message.toString());
      const eventType = data.event || data.type;
      console.log('[WS Event]', eventType, JSON.stringify(data, null, 2));

      if (eventType === 'setup') {
        callSid = data.callSid;
        
        // Get parameters from TwiML <Parameter> tags (preferred) or URL fallback
        const customParams = data.customParameters || {};
        const finalBusinessName = customParams.businessName || businessName;
        const finalProductCategory = customParams.productCategory || productCategory;
        const finalBrandName = customParams.brandName || brandName;

        state = {
          callSid,
          streamSid: '',
          businessName: finalBusinessName,
          productCategory: finalProductCategory,
          brandName: finalBrandName,
          messages: [],
          turnCount: 0,
          ws,
        };
        conversations.set(callSid, state);

        const greeting = `Hello, this is Alex calling from ${finalBrandName}. I'm reaching out regarding ${finalProductCategory}. Do you have a moment to talk?`;
        
        state.messages.push({
          role: 'assistant',
          content: greeting,
        });

        ws.send(
          JSON.stringify({
            type: 'text',
            token: greeting,
            last: true,
          })
        );

        console.log(`[Setup] CallSid: ${callSid}, Business: ${businessName}`);
      } else if (eventType === 'prompt' && data.voicePrompt) {
        if (!state) {
          console.warn('[Prompt] No state found, creating new state');
          callSid = callSid || 'unknown';
          state = {
            callSid,
            streamSid: '',
            businessName,
            productCategory,
            brandName,
            messages: [],
            turnCount: 0,
            ws,
          };
          conversations.set(callSid, state);
        }

        const userSpeech = data.voicePrompt;
        console.log(`[User Speech] "${userSpeech}"`);

        const { message, shouldEndCall } = await generateAIResponse(
          state,
          userSpeech
        );

        ws.send(
          JSON.stringify({
            type: 'text',
            token: message,
            last: true,
          })
        );

        console.log(`[AI Response Sent] "${message}"`);

        if (shouldEndCall) {
          setTimeout(() => {
            ws.close();
          }, 2000);
        }
      } else if (eventType === 'interrupt') {
        console.log('[Interrupt] User interrupted AI');
      } else if (eventType === 'dtmf') {
        console.log('[DTMF] Digit pressed:', data.digit);
      } else if (eventType === 'error') {
        console.error('[Twilio Error]', data.message);
      } else if (eventType === 'stop') {
        console.log('[Stop] Conversation ended');
        if (callSid) {
          conversations.delete(callSid);
        }
      } else {
        console.log('[Unknown Event]', eventType, data);
      }
    } catch (error) {
      console.error('[WS Error]', error);
    }
  });

  ws.on('close', (code, reason) => {
    console.log('[WebSocket] Connection closed - Code:', code, 'Reason:', reason.toString());
    clearInterval(pingInterval);
    if (callSid) {
      conversations.delete(callSid);
    }
  });

  ws.on('error', (error) => {
    console.error('[WebSocket Error]', error);
  });
  
  ws.on('ping', (data) => {
    console.log('[WebSocket] Ping received');
  });
  
  ws.on('pong', (data) => {
    console.log('[WebSocket] Pong received');
  });
}

const handleTwiML = (req: Request, res: Response) => {
  const businessName = req.query.businessName as string || 'Test Business';
  const productCategory = req.query.productCategory as string || 'Test Services';
  const brandName = req.query.brandName as string || 'TestCo';

  // Get WebSocket URL (works on Render, Replit, and local dev)
  const wsUrl = getWebSocketUrl(`/voice/relay?businessName=${encodeURIComponent(businessName)}&productCategory=${encodeURIComponent(productCategory)}&brandName=${encodeURIComponent(brandName)}`);
  if (!wsUrl) {
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Server configuration error. The service is not properly configured. Please contact technical support.</Say>
  <Hangup/>
</Response>`;
    console.error('[TwiML] ERROR: Deployment hostname not configured');
    // Return 200 so Twilio processes the TwiML gracefully
    return res.type('text/xml').status(200).send(errorTwiml);
  }

  // XML-escape the URL for TwiML (& must be &amp; in XML)
  const xmlSafeUrl = wsUrl.replace(/&/g, '&amp;');

  // ElevenLabs voice configuration for ConversationRelay
  // Format: VOICE_ID-MODEL-SPEED_STABILITY_SIMILARITY
  // Brian voice: pNInz6obpgDQGcFmaJgB
  // Parameters: speed=1.0, stability=0.65, similarity=0.9
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay 
      url="${xmlSafeUrl}"
      ttsProvider="ElevenLabs"
      voice="pNInz6obpgDQGcFmaJgB-turbo_v2_5-1.0_0.65_0.9"
      dtmfDetection="true"
    />
  </Connect>
</Response>`;

  console.log(`[TwiML] ${req.method} request - Connecting to: ${wsUrl}`);
  res.type('text/xml').send(twiml);
};

// Simple test endpoint - no WebSocket needed
const handleSimpleTwiML = (req: Request, res: Response) => {
  const businessName = req.query.businessName as string || 'Test Business';
  const productCategory = req.query.productCategory as string || 'Test Services';
  const brandName = req.query.brandName as string || 'TestCo';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello, this is a test call from ${brandName.replace(/[<>&'"]/g, '')}. We are calling about ${productCategory.replace(/[<>&'"]/g, '')}. If you can hear this message, Twilio is working correctly. Goodbye.</Say>
  <Hangup/>
</Response>`;

  console.log(`[Simple TwiML Test] Basic call without WebSocket for ${brandName}`);
  res.type('text/xml').send(twiml);
};

// Diagnostic test with Amazon Polly (always available)
const handlePollyTest = (req: Request, res: Response) => {
  const businessName = req.query.businessName as string || 'Test Business';
  const productCategory = req.query.productCategory as string || 'Test Services';
  const brandName = req.query.brandName as string || 'TestCo';

  // Use clean URL without query parameters - pass data via TwiML Parameters instead
  const wsUrl = getWebSocketUrl('/voice/relay');
  if (!wsUrl) {
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Server configuration error. The service is not properly configured. Please contact technical support.</Say>
  <Hangup/>
</Response>`;
    console.error('[Polly Test] ERROR: Deployment hostname not configured');
    // Return 200 so Twilio processes the TwiML gracefully
    return res.type('text/xml').status(200).send(errorTwiml);
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay 
      url="${wsUrl}"
      ttsProvider="Amazon"
      voice="Matthew-Neural"
      dtmfDetection="true">
      <Parameter name="businessName" value="${businessName.replace(/[<>&'"]/g, '')}" />
      <Parameter name="productCategory" value="${productCategory.replace(/[<>&'"]/g, '')}" />
      <Parameter name="brandName" value="${brandName.replace(/[<>&'"]/g, '')}" />
    </ConversationRelay>
  </Connect>
</Response>`;

  console.log(`[Polly Test] ${req.method} request - Testing WebSocket with Amazon Polly voice (Matthew-Neural)`);
  console.log(`[Polly Test] TwiML:`, twiml);
  res.type('text/xml').send(twiml);
};

// Ultra-minimal test - ABSOLUTE BARE BONES - default everything
const handleMinimalTest = (req: Request, res: Response) => {
  console.log('='.repeat(80));
  console.log(`[TwiML BARE BONES] ✅ ${req.method} REQUEST RECEIVED`);
  console.log(`[TwiML BARE BONES] Testing with MINIMAL TwiML - default voice, no extra params`);
  console.log('='.repeat(80));
  
  const wsUrl = getWebSocketUrl('/voice/relay');
  if (!wsUrl) {
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Server configuration error. The service is not properly configured. Please contact technical support.</Say>
  <Hangup/>
</Response>`;
    console.error('[Minimal Test] ERROR: Deployment hostname not configured');
    // Return 200 so Twilio processes the TwiML gracefully
    return res.type('text/xml').status(200).send(errorTwiml);
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay url="${wsUrl}" />
  </Connect>
</Response>`;

  console.log(`[TwiML BARE BONES] TwiML:`, twiml);
  res.type('text/xml').send(twiml);
  console.log(`[TwiML BARE BONES] ✅ Response sent`);
};

router.get('/twiml', handleTwiML);
router.post('/twiml', handleTwiML);
router.get('/twiml-polly-test', handlePollyTest);
router.post('/twiml-polly-test', handlePollyTest);
router.get('/twiml-minimal', handleMinimalTest);
router.post('/twiml-minimal', handleMinimalTest);
router.get('/twiml-test', handleSimpleTwiML);
router.post('/twiml-test', handleSimpleTwiML);

export default router;

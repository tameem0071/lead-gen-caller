import { Router } from 'express';
import type { Request, Response } from 'express';
import type { WebSocket } from 'ws';
import OpenAI from 'openai';

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

const SYSTEM_PROMPT = `You're Alex, calling on behalf of a company. You sound completely human - warm, confident, professional but friendly.

CRITICAL RULES:
1. Keep it SHORT - 1-2 sentences max per response. This is a phone call.
2. Sound NATURAL - use contractions, casual language, filler words sometimes
3. NO PLACEHOLDERS - Never say [Your Name] or [Company]. Use what you know or stay general
4. Be CONVERSATIONAL - like chatting with someone you just met at a coffee shop
5. MIRROR their energy - busy person? Be brief. Chatty? Engage more

PERSONALITY:
- You're Alex - friendly, knowledgeable, not pushy
- Speak like you're smiling - upbeat but not fake
- Use "um", "you know", "like" occasionally (sparingly)
- Start sentences naturally: "So...", "Actually...", "Yeah..."
- Acknowledge what they say: "Totally", "I hear you", "Makes sense"

EXAMPLES:
User: "Who is this?"
You: "Oh hey! This is Alex from TestCo. We got your request about our services. Got a quick sec?"

User: "How much does it cost?"
You: "Yeah so most clients end up around $500-1000 a month depending on what they need, you know?"

User: "I'm busy"
You: "[END_CALL] No problem at all! I'll shoot you an email instead. Take care!"

TO END CALL: Start with [END_CALL]
- "[END_CALL] Alright cool, I'll let you go. Have a good one!"
- "[END_CALL] No worries! I'll follow up later. Thanks!"

Remember: You're just a regular person. Natural. Warm. Brief. Human.`;

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

  let callSid: string = '';
  let state: ConversationState | undefined;

  const url = req.url || '';
  const urlParams = new URLSearchParams(url.split('?')[1] || '');
  const businessName = urlParams.get('businessName') || 'your business';
  const productCategory = urlParams.get('productCategory') || 'our services';
  const brandName = urlParams.get('brandName') || 'the company';

  console.log('[WebSocket] Params:', { businessName, productCategory, brandName });

  // Send immediate acknowledgment to Twilio
  ws.on('open', () => {
    console.log('[WebSocket] Connection opened successfully');
  });

  ws.on('message', async (message: any) => {
    try {
      const data = JSON.parse(message.toString());
      const eventType = data.event || data.type;
      console.log('[WS Event]', eventType, data);

      if (eventType === 'setup') {
        callSid = data.callSid;

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

        const greeting = `Hey! This is Alex from ${brandName}. We got your info about ${productCategory}. You got a minute?`;
        
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

  ws.on('close', () => {
    console.log('[WebSocket] Connection closed');
    if (callSid) {
      conversations.delete(callSid);
    }
  });

  ws.on('error', (error) => {
    console.error('[WebSocket Error]', error);
  });
}

const handleTwiML = (req: Request, res: Response) => {
  const businessName = req.query.businessName as string || 'Test Business';
  const productCategory = req.query.productCategory as string || 'Test Services';
  const brandName = req.query.brandName as string || 'TestCo';

  const wsUrl = `wss://${process.env.REPLIT_DEV_DOMAIN || 'your-repl-url.replit.dev'}/voice/relay?businessName=${encodeURIComponent(businessName)}&productCategory=${encodeURIComponent(productCategory)}&brandName=${encodeURIComponent(brandName)}`;

  // XML-escape the URL for TwiML (& must be &amp; in XML)
  const xmlSafeUrl = wsUrl.replace(/&/g, '&amp;');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay 
      url="${xmlSafeUrl}"
      ttsProvider="ElevenLabs"
      voice="pNInz6obpgDQGcFmaJgB"
      dtmfDetection="true"
    />
  </Connect>
</Response>`;

  console.log(`[TwiML] ${req.method} request - Connecting to: ${wsUrl}`);
  res.type('text/xml').send(twiml);
};

router.get('/twiml', handleTwiML);
router.post('/twiml', handleTwiML);

export default router;

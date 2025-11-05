import { Router } from 'express';
import type { Request, Response } from 'express';
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
  businessName: string;
  productCategory: string;
  brandName: string;
  messages: Message[];
  turnCount: number;
  hasGreeted: boolean;
}

const conversations = new Map<string, ConversationState>();

const SYSTEM_PROMPT = `You are a professional B2B sales representative making an outbound call. Your goal is to have a natural, helpful conversation.

CRITICAL RULES:
1. Keep responses SHORT - 1-2 sentences max. Phone calls need to be conversational, not lectures.
2. Answer questions DIRECTLY. If they ask "how much", give a clear answer or range.
3. Be HUMAN - use natural speech, contractions, and casual language.
4. Listen and respond to what they ACTUALLY say, not what you expect.
5. If they're not interested, politely end the call immediately.
6. If they want to talk to someone else, offer to have a manager call them back.
7. Never repeat yourself or ignore what they just said.

CONVERSATION GOALS (in order):
- Qualify if they're interested in the product
- Answer any questions they have
- Offer to send information via text
- Schedule a follow-up if appropriate

TONE: Friendly, professional, conversational. Like a real human having a chat.

When you want to END the call, your response MUST start with [END_CALL] followed by your goodbye message.
Example: "[END_CALL] No problem at all! Thanks for your time. Have a great day!"

DO NOT use [END_CALL] unless the person is clearly not interested, wants to end the call, or the conversation has reached a natural conclusion.`;

async function generateAIResponse(state: ConversationState, userMessage: string): Promise<{
  message: string;
  shouldEndCall: boolean;
}> {
  state.messages.push({
    role: 'user',
    content: userMessage,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT + `\n\nCONTEXT: You're calling from ${state.brandName} about ${state.productCategory}. The business you're calling is ${state.businessName}.`,
        },
        ...state.messages,
      ],
      temperature: 0.8,
      max_tokens: 150,
    });

    const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, could you repeat that?";
    
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

    if (state.turnCount >= 8) {
      shouldEndCall = true;
      if (!cleanResponse.toLowerCase().includes('goodbye') && !cleanResponse.toLowerCase().includes('bye')) {
        cleanResponse += " Thanks so much for your time today!";
      }
    }

    console.log(`[AI Response] Turn ${state.turnCount}: "${cleanResponse}" (shouldEnd: ${shouldEndCall})`);

    return { message: cleanResponse, shouldEndCall };
  } catch (error) {
    console.error('[AI Error]', error);
    return {
      message: "I'm having a bit of technical difficulty. Let me have someone call you back shortly.",
      shouldEndCall: true,
    };
  }
}

function buildTwiML(message: string, shouldEndCall: boolean): string {
  const voice = 'Polly.Joanna';
  
  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  if (shouldEndCall) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${escapedMessage}</Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${escapedMessage}</Say>
  <Gather
    input="speech"
    action="/voice/handle"
    method="POST"
    speechTimeout="auto"
    timeout="6"
    profanityFilter="false"
    language="en-US"
  >
  </Gather>
  <Say voice="${voice}">I didn't hear anything. Are you still there?</Say>
  <Redirect>/voice/handle</Redirect>
</Response>`;
}

router.post('/start', async (req: Request, res: Response) => {
  const callSid = req.body.CallSid;
  const to = req.body.To;
  const from = req.body.From;

  const businessName = req.query.businessName as string || req.body.businessName || 'your business';
  const productCategory = req.query.productCategory as string || req.body.productCategory || 'our services';
  const brandName = req.query.brandName as string || req.body.brandName || 'our company';

  console.log(`[Voice Start] CallSid: ${callSid}, To: ${to}, From: ${from}, Business: ${businessName}`);

  const state: ConversationState = {
    callSid,
    businessName,
    productCategory,
    brandName,
    messages: [],
    turnCount: 0,
    hasGreeted: true,
  };
  conversations.set(callSid, state);

  const greeting = `Hi! This is ${brandName} calling about ${productCategory}. We received your inquiry and wanted to reach out personally. Do you have a quick moment to chat?`;

  state.messages.push({
    role: 'assistant',
    content: greeting,
  });

  const twiml = buildTwiML(greeting, false);
  res.type('text/xml').send(twiml);
});

router.post('/handle', async (req: Request, res: Response) => {
  const callSid = req.body.CallSid;
  const speechResult = req.body.SpeechResult;
  const confidence = req.body.Confidence;

  console.log(`[Voice Handle] CallSid: ${callSid}, Speech: "${speechResult}", Confidence: ${confidence}`);

  let state = conversations.get(callSid);
  if (!state) {
    console.warn(`[Voice Handle] No state found for ${callSid}, ending call`);
    const twiml = buildTwiML("I'm sorry, we seem to have lost the connection. We'll call you back shortly.", true);
    res.type('text/xml').send(twiml);
    return;
  }

  if (!speechResult || speechResult.trim() === '') {
    const twiml = buildTwiML("I'm having trouble hearing you. Let me have someone call you back. Thanks!", true);
    conversations.delete(callSid);
    res.type('text/xml').send(twiml);
    return;
  }

  const conf = parseFloat(confidence || '0');
  if (conf < 0.4) {
    console.log(`[Voice Handle] Low confidence (${conf}), asking for repeat`);
    const twiml = buildTwiML("Sorry, I didn't catch that. Could you say that again?", false);
    res.type('text/xml').send(twiml);
    return;
  }

  const { message, shouldEndCall } = await generateAIResponse(state, speechResult);
  const twiml = buildTwiML(message, shouldEndCall);

  if (shouldEndCall) {
    setTimeout(() => conversations.delete(callSid), 30000);
  }

  res.type('text/xml').send(twiml);
});

setInterval(() => {
  const maxAge = 15 * 60 * 1000;
  const now = Date.now();
  
  for (const [callSid, state] of Array.from(conversations.entries())) {
    if (state.turnCount > 0) {
      conversations.delete(callSid);
    }
  }
}, 5 * 60 * 1000);

export default router;

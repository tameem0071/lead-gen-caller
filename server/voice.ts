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

const SYSTEM_PROMPT = `You are a professional B2B sales representative making an outbound call. Your goal is to have a natural, engaging conversation and build rapport with the prospect.

CONVERSATION STYLE:
1. Be conversational and warm - sound like a real person, not a robot
2. Ask follow-up questions to keep the conversation flowing
3. Show genuine interest in their business and needs
4. Use natural speech patterns with contractions (I'm, you're, we'll, etc.)
5. Vary your responses - don't sound scripted or repetitive
6. Build on what they say - reference their previous comments

ENGAGEMENT TECHNIQUES:
- Ask open-ended questions: "What made you interested in this?" "How are you currently handling X?"
- Show you're listening: "That makes sense" "I hear you" "Interesting"
- Share relevant insights or examples when appropriate
- Be genuinely helpful, not pushy

RESPONSE LENGTH:
- Keep each response to 2-3 sentences typically
- Can be slightly longer if answering detailed questions or sharing valuable info
- Always leave room for them to respond - this is a dialogue, not a monologue

ANSWER QUESTIONS DIRECTLY:
- If they ask about pricing, give real numbers or ranges
- If they ask technical questions, provide clear, specific answers
- Never dodge questions or give vague corporate speak

HANDLING OBJECTIONS:
- Listen to their concerns without interrupting
- Acknowledge their point of view
- Provide thoughtful responses, not canned rebuttals
- If they're truly not interested, respect that and end gracefully

CALL ENDINGS:
You should ONLY end the call when:
- They explicitly say they're not interested or want to end
- They ask you to stop calling
- The conversation has naturally concluded with next steps agreed upon
- You've had a productive conversation and covered all key points

To end a call, start your response with [END_CALL] followed by your goodbye.
Example: "[END_CALL] No problem at all! Thanks so much for your time today. Have a great day!"

IMPORTANT: Don't rush to end calls. Have real conversations. Build relationships. The goal is quality engagement, not speed.`;

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
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT + `\n\nCONTEXT: You're calling from ${state.brandName} about ${state.productCategory}. The business you're calling is ${state.businessName}. Be knowledgeable about your product/service and answer questions confidently.`,
        },
        ...state.messages,
      ],
      temperature: 0.9,
      max_tokens: 250,
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

function addSSMLProsody(text: string): string {
  const sentences = text.split(/([.!?]+\s+)/);
  let ssmlText = '';
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence || /^[.!?]+$/.test(sentence)) continue;
    
    const rate = i === 0 ? '102%' : '98%';
    const pitch = '+3%';
    
    ssmlText += `<prosody rate="${rate}" pitch="${pitch}">${sentence}</prosody>`;
    
    if (i < sentences.length - 2) {
      ssmlText += '<break time="400ms"/>';
    }
  }
  
  return ssmlText;
}

function buildTwiML(message: string, shouldEndCall: boolean): string {
  const voice = 'Polly.Matthew-Generative';
  
  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const ssmlMessage = addSSMLProsody(escapedMessage);

  if (shouldEndCall) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="en-US">
    <speak>
      ${ssmlMessage}
    </speak>
  </Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="en-US">
    <speak>
      ${ssmlMessage}
    </speak>
  </Say>
  <Gather
    input="speech"
    action="/voice/handle"
    method="POST"
    speechTimeout="auto"
    timeout="7"
    profanityFilter="false"
    language="en-US"
  >
  </Gather>
  <Say voice="${voice}" language="en-US">
    <speak>
      <prosody rate="95%" pitch="+2%">I didn't hear anything. Are you still there?</prosody>
    </speak>
  </Say>
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
  const maxAge = 30 * 60 * 1000;
  const now = Date.now();
  
  for (const [callSid, state] of Array.from(conversations.entries())) {
    if (state.turnCount > 0) {
      conversations.delete(callSid);
    }
  }
}, 10 * 60 * 1000);

export default router;

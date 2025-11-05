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

const SYSTEM_PROMPT = `You're calling on behalf of a company. Talk like a real person - casual, friendly, natural.

CRITICAL RULES:
1. NEVER use placeholders like [Your Name], [Company], [specific benefit], etc. If you don't know something specific, stay general or ask them about it
2. Keep responses SHORT - 1-2 sentences max. This is a phone call, not an email
3. Sound CASUAL - like you're chatting with a friend, not reading a script
4. Use filler words occasionally: "um", "you know", "like", "I mean"
5. Be REAL - if they ask something you don't know, say "good question, let me find out"

HOW TO SOUND HUMAN:
- Start sentences naturally: "So...", "Actually...", "Oh...", "Yeah..."
- Use contractions ALWAYS: I'm, you're, we're, that's, don't, can't
- Mirror their energy - if they're short, be brief. If they're chatty, chat
- Laugh or acknowledge humor: "Ha, right?", "Totally"
- Be imperfect - it's okay to say "um" or pause

WHAT TO AVOID:
- Corporate speak: "leverage", "solutions", "synergy", "value proposition"
- Scripted phrases: "I'd love to learn more about", "Does that make sense?"
- Overly formal: "I appreciate your time", "Thank you for the opportunity"
- Placeholders: NEVER say [anything in brackets]

EXAMPLES OF GOOD RESPONSES:
- "Oh hey, yeah I'm calling from [company name]. We help businesses with [their thing]. Got a sec?"
- "Honestly? Most people save like 20-30%. But depends on your setup you know?"
- "Hmm good question. Can I grab your email and send you the details?"

TO END CALL - put [END_CALL] at start:
"[END_CALL] Alright cool, I'll let you go. Take care!"
"[END_CALL] No worries at all. Have a good one!"

Remember: You're just a regular person making a call. Not a robot. Not a salesperson reading a script. Just... talk.`;

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
      temperature: 1.0,
      max_tokens: 120,
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
  
  const rates = ['95%', '100%', '105%', '98%', '102%'];
  const pitches = ['+1%', '+2%', '-1%', '0%'];
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence || /^[.!?]+$/.test(sentence)) continue;
    
    const rate = rates[i % rates.length];
    const pitch = pitches[i % pitches.length];
    
    ssmlText += `<prosody rate="${rate}" pitch="${pitch}">${sentence}</prosody>`;
    
    if (i < sentences.length - 2 && sentence.endsWith('.')) {
      ssmlText += '<break time="300ms"/>';
    } else if (i < sentences.length - 2 && (sentence.endsWith('?') || sentence.endsWith('!'))) {
      ssmlText += '<break time="200ms"/>';
    }
  }
  
  return ssmlText;
}

function buildTwiML(message: string, shouldEndCall: boolean): string {
  const voice = 'Polly.Matthew';
  
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
  <Say voice="${voice}" language="en-US">${ssmlMessage}</Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="en-US">${ssmlMessage}</Say>
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
  <Say voice="${voice}" language="en-US"><prosody rate="95%" pitch="+2%">I didn&apos;t hear anything. Are you still there?</prosody></Say>
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

  const greeting = `Hey! This is ${brandName}. We got your info about ${productCategory} and I wanted to give you a quick call. You got a minute?`;

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

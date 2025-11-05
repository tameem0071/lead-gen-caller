import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// In-memory conversation state keyed by CallSid
interface ConversationState {
  callSid: string;
  attempts: number;
  stage: 'greeting' | 'interest_check' | 'pricing' | 'scheduling' | 'closing';
  businessName?: string;
  productCategory?: string;
  brandName?: string;
  userResponses: string[];
  lastIntent?: string;
}

const conversations = new Map<string, ConversationState>();

// Intent recognition - simple rule-based
function detectIntent(speechResult: string | undefined, confidence: string | undefined): {
  intent: string;
  confidence: number;
} {
  if (!speechResult) {
    return { intent: 'silence', confidence: 0 };
  }

  const text = speechResult.toLowerCase().trim();
  const conf = parseFloat(confidence || '0');

  // Low confidence threshold
  if (conf < 0.5) {
    return { intent: 'unclear', confidence: conf };
  }

  // Intent patterns
  if (/\b(yes|yeah|sure|absolutely|definitely|interested|sounds good)\b/.test(text)) {
    return { intent: 'affirmative', confidence: conf };
  }
  
  if (/\b(no|nope|not interested|no thanks|don't|stop)\b/.test(text)) {
    return { intent: 'negative', confidence: conf };
  }
  
  if (/\b(price|cost|pricing|how much|expensive|cheap|afford)\b/.test(text)) {
    return { intent: 'pricing_inquiry', confidence: conf };
  }
  
  if (/\b(call back|later|schedule|another time|busy|not now)\b/.test(text)) {
    return { intent: 'schedule_followup', confidence: conf };
  }
  
  if (/\b(owner|manager|decision maker|boss|supervisor)\b/.test(text)) {
    return { intent: 'transfer_request', confidence: conf };
  }

  // Default to unclear if no pattern matched
  return { intent: 'unclear', confidence: conf };
}

// Generate natural TwiML response
function generateResponse(state: ConversationState, intent: string): string {
  let message = '';
  let nextAction: 'gather' | 'hangup' = 'gather';
  let nextStage = state.stage;

  switch (state.stage) {
    case 'greeting':
      if (intent === 'affirmative') {
        message = "Great! Let me tell you a bit more about what we offer.";
        nextStage = 'interest_check';
      } else if (intent === 'negative') {
        message = "No problem at all. Thanks for your time, and have a wonderful day!";
        nextAction = 'hangup';
      } else if (intent === 'schedule_followup') {
        message = "I understand you're busy. We'll follow up with you via text shortly. Have a great day!";
        nextAction = 'hangup';
      } else if (intent === 'transfer_request') {
        message = "I'd be happy to have someone from our team reach out directly. We'll have a manager contact you shortly. Thanks for your time!";
        nextAction = 'hangup';
      } else if (intent === 'pricing_inquiry') {
        message = "Great question! We have very competitive pricing. Would you like us to send you a detailed quote via text?";
        nextStage = 'pricing';
      } else {
        message = "I didn't quite catch that. Are you interested in learning more about our services?";
      }
      break;

    case 'interest_check':
      if (intent === 'pricing_inquiry') {
        message = `Our pricing is very competitive. We'd love to provide you with a custom quote. Would you like us to send that over via text?`;
        nextStage = 'pricing';
      } else if (intent === 'affirmative') {
        message = "Excellent! Would you like to know about our pricing, or should we schedule a follow-up call?";
        nextStage = 'pricing';
      } else if (intent === 'negative') {
        message = "I appreciate your time. If anything changes, feel free to reach out. Take care!";
        nextAction = 'hangup';
      } else if (intent === 'schedule_followup') {
        message = "No problem! We'll follow up with you at a better time. Thank you!";
        nextAction = 'hangup';
      } else if (intent === 'transfer_request') {
        message = "Absolutely! I'll make sure one of our senior team members reaches out to you directly. Have a great day!";
        nextAction = 'hangup';
      } else {
        message = "Would you be interested in hearing about our pricing and options?";
      }
      break;

    case 'pricing':
      if (intent === 'affirmative') {
        message = "Perfect! We'll send you detailed pricing via text message shortly. Is there anything else I can help with?";
        nextStage = 'closing';
      } else if (intent === 'schedule_followup') {
        message = "Sounds good. We'll reach out to schedule a convenient time. Thanks so much!";
        nextAction = 'hangup';
      } else if (intent === 'negative') {
        message = "No worries. Thanks for your time today!";
        nextAction = 'hangup';
      } else if (intent === 'transfer_request') {
        message = "I completely understand. We'll have a senior team member contact you with all the pricing details. Thanks for your interest!";
        nextAction = 'hangup';
      } else {
        message = "Should we send you our pricing information via text?";
      }
      break;

    case 'closing':
      if (intent === 'transfer_request') {
        message = "Absolutely! We'll have a manager reach out to you directly. Thank you so much for your time!";
        nextAction = 'hangup';
      } else if (intent === 'schedule_followup') {
        message = "Perfect! We'll be in touch to schedule a follow-up. Have a wonderful day!";
        nextAction = 'hangup';
      } else {
        message = "Thank you so much for your time. We'll be in touch soon. Have a great day!";
        nextAction = 'hangup';
      }
      break;
  }

  // Update state
  state.stage = nextStage;
  state.lastIntent = intent;

  // Build TwiML
  const voice = 'Polly.Joanna'; // Amazon Polly Joanna for natural sound
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${message}</Say>
  ${nextAction === 'gather' ? `
  <Gather
    input="speech"
    action="/voice/handle"
    method="POST"
    speechTimeout="auto"
    timeout="5"
    hints="yes,no,price,pricing,cost,owner,manager,later,call back,not interested,busy"
    profanityFilter="false"
  >
  </Gather>
  <Say voice="${voice}">I didn't hear anything. Let me try again.</Say>
  <Redirect>/voice/handle</Redirect>
  ` : `
  <Pause length="1"/>
  <Hangup/>
  `}
</Response>`;

  return twiml;
}

// POST /voice/start - Initial greeting and first question
router.post('/start', (req: Request, res: Response) => {
  const callSid = req.body.CallSid;
  const to = req.body.To;
  const from = req.body.From;

  // Extract business context from query parameters or body (Twilio sends custom params in body)
  const businessName = req.query.businessName as string || req.body.businessName || 'a potential customer';
  const productCategory = req.query.productCategory as string || req.body.productCategory || 'our services';
  const brandName = req.query.brandName as string || req.body.brandName || 'our company';

  console.log(`[Voice Start] CallSid: ${callSid}, To: ${to}, From: ${from}, Business: ${businessName}`);

  // Initialize conversation state
  const state: ConversationState = {
    callSid,
    attempts: 0,
    stage: 'greeting',
    businessName,
    productCategory,
    brandName,
    userResponses: [],
  };
  conversations.set(callSid, state);

  // Generate greeting with first question
  const voice = 'Polly.Joanna';
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">
    Hi! This is ${brandName} calling about ${productCategory}.
    We received your request and wanted to reach out personally.
    Do you have a quick moment to chat?
  </Say>
  <Gather
    input="speech"
    action="/voice/handle"
    method="POST"
    speechTimeout="auto"
    timeout="5"
    hints="yes,no,sure,yeah,not interested,busy,later"
    profanityFilter="false"
  >
  </Gather>
  <Say voice="${voice}">I didn't hear a response. Are you still there?</Say>
  <Redirect>/voice/handle</Redirect>
</Response>`;

  res.type('text/xml');
  res.send(twiml);
});

// POST /voice/handle - Parse speech and respond
router.post('/handle', (req: Request, res: Response) => {
  const callSid = req.body.CallSid;
  const speechResult = req.body.SpeechResult;
  const confidence = req.body.Confidence;

  console.log(`[Voice Handle] CallSid: ${callSid}, Speech: "${speechResult}", Confidence: ${confidence}`);

  // Get or create conversation state
  let state = conversations.get(callSid);
  if (!state) {
    console.warn(`[Voice Handle] No state found for ${callSid}, creating new state`);
    state = {
      callSid,
      attempts: 0,
      stage: 'greeting',
      userResponses: [],
    };
    conversations.set(callSid, state);
  }

  // Store user response
  if (speechResult) {
    state.userResponses.push(speechResult);
  }

  // Detect intent
  const { intent, confidence: detectedConfidence } = detectIntent(speechResult, confidence);
  console.log(`[Voice Handle] Detected intent: ${intent} (confidence: ${detectedConfidence})`);

  // Handle silence or unclear responses with retry limit
  if ((intent === 'silence' || intent === 'unclear') && state.attempts < 2) {
    state.attempts++;
    
    const voice = 'Polly.Joanna';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">
    Sorry, I didn't quite catch that. Could you repeat that for me?
  </Say>
  <Gather
    input="speech"
    action="/voice/handle"
    method="POST"
    speechTimeout="auto"
    timeout="5"
    hints="yes,no,price,pricing,owner,manager,later,not interested"
    profanityFilter="false"
  >
  </Gather>
  <Say voice="${voice}">I'm having trouble hearing you. We'll follow up another way. Goodbye!</Say>
  <Hangup/>
</Response>`;
    
    res.type('text/xml');
    res.send(twiml);
    return;
  }

  // Max retries exceeded - graceful exit
  if (state.attempts >= 2) {
    const voice = 'Polly.Joanna';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">
    We're having trouble with the connection. We'll reach out via text instead. Have a great day!
  </Say>
  <Hangup/>
</Response>`;
    
    // Clean up state
    conversations.delete(callSid);
    
    res.type('text/xml');
    res.send(twiml);
    return;
  }

  // Reset attempts on successful recognition
  state.attempts = 0;

  // Generate contextual response
  const twiml = generateResponse(state, intent);
  
  // Clean up state if call is ending
  if (twiml.includes('<Hangup')) {
    setTimeout(() => conversations.delete(callSid), 60000); // Clean up after 1 minute
  }

  res.type('text/xml');
  res.send(twiml);
});

// Cleanup old conversation states (run periodically)
setInterval(() => {
  const now = Date.now();
  const timeout = 10 * 60 * 1000; // 10 minutes
  
  for (const [callSid, state] of Array.from(conversations.entries())) {
    // Note: We'd need to track timestamp in state for proper cleanup
    // For now, we rely on manual cleanup after hangup
  }
}, 5 * 60 * 1000); // Every 5 minutes

export default router;

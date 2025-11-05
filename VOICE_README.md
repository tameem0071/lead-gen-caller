# AI-Powered Conversational Voice System

This application features a **real AI-powered conversational caller** that uses OpenAI's GPT models to have natural, intelligent phone conversations with leads. Unlike scripted systems, this AI can answer questions, handle objections, and respond naturally to anything a caller says.

## 🤖 What Makes This Different

**OLD System (Pattern Matching):**
- ❌ Followed rigid scripts
- ❌ Only recognized specific keywords
- ❌ Couldn't answer questions
- ❌ Felt robotic and repetitive

**NEW System (Real AI):**
- ✅ Understands natural language
- ✅ Answers questions intelligently
- ✅ Adapts to the conversation
- ✅ Sounds like a real human

## Features

- **Real AI conversation** powered by OpenAI GPT-4o-mini
- **Conversation memory** - AI remembers what was said earlier
- **Smart call endings** - AI knows when to politely end calls
- **Natural responses** - No more scripted, robotic answers
- **Question answering** - Can respond to pricing, features, objections
- **Amazon Polly "Joanna" voice** for natural-sounding speech

## How It Works

### The AI's Role

The AI acts as a professional B2B sales representative with these instructions:

**Key Rules:**
1. **Keep responses SHORT** (1-2 sentences) - phone calls need quick back-and-forth
2. **Answer questions DIRECTLY** - if they ask about pricing, give a real answer
3. **Be HUMAN** - use contractions, natural language, casual tone
4. **Listen and respond** to what they actually say, not what you expect
5. **End calls politely** when people aren't interested
6. **Offer manager callbacks** if requested

**Conversation Goals:**
- Qualify if they're interested
- Answer their questions
- Offer to send info via text
- Schedule follow-ups if appropriate

### Conversation Flow

Unlike the old scripted system, the AI **adapts dynamically**:

**Example Conversation 1 (Interested Lead):**
```
AI: Hi! This is AcmeTech calling about Cloud Services. 
    We received your inquiry. Do you have a moment?

Caller: "Yeah, what's the pricing like?"

AI: Our plans start at $99/month for small teams, up to custom 
    enterprise pricing. What size is your team?

Caller: "About 50 people"

AI: Perfect! For 50 users, you'd be looking at around $500-700/month 
    depending on features. Want me to text you the details?

Caller: "Sure"

AI: Great! I'll send that over now. Anything else I can help with?
```

**Example Conversation 2 (Not Interested):**
```
AI: Hi! This is AcmeTech calling about Cloud Services. 
    We received your inquiry. Do you have a moment?

Caller: "Actually, we're not interested anymore"

AI: No problem at all! Thanks for your time. Have a great day!
[Call ends]
```

**Example Conversation 3 (Transfer Request):**
```
AI: Hi! This is AcmeTech calling about Cloud Services...

Caller: "Can I talk to your manager?"

AI: Absolutely! I'll have one of our senior team members call you back 
    within the hour. Thanks for your time!
[Call ends]
```

### Conversation Memory

The AI maintains full context throughout the call:

```javascript
state.messages = [
  { role: 'assistant', content: 'Hi! This is...' },
  { role: 'user', content: 'Yeah, how much does it cost?' },
  { role: 'assistant', content: 'Our pricing starts at...' },
  { role: 'user', content: 'What about for 50 users?' },
  // AI can reference all previous messages
]
```

This allows the AI to:
- Remember what they asked
- Build on previous answers
- Maintain conversation coherence
- Avoid repeating information

## Environment Setup

### Required Environment Variables

**Twilio** (via Replit connector - already set up):
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_NUMBER`

**OpenAI** (via Replit AI Integrations - already set up):
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`

**Domain** (automatically provided):
- `REPLIT_DEV_DOMAIN` or `PUBLIC_BASE_URL`

All credentials are managed through Replit Connectors - no manual setup needed!

## API Endpoints

### Voice Routes (Twilio Webhooks)

#### `POST /voice/start`
Initial AI greeting when call connects.

**Parameters** (via URL):
- `businessName` - Company being called
- `productCategory` - Product/service type
- `brandName` - Your brand name

**Returns**: TwiML with AI greeting and speech gather

#### `POST /voice/handle`
Handles ongoing conversation with AI.

**Parameters** (from Twilio):
- `CallSid` - Unique call identifier
- `SpeechResult` - What the caller said
- `Confidence` - Speech recognition confidence

**How it works:**
1. Retrieves conversation state by CallSid
2. Sends caller's message + full history to OpenAI
3. Gets AI-generated response
4. Detects if call should end (via [END_CALL] marker)
5. Returns TwiML with AI response

### Test Endpoint

#### `POST /api/simulate`
Trigger test calls easily.

**Example**:
```bash
curl -X POST https://your-app.repl.co/api/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+15551234567",
    "businessName": "Test Corp",
    "productCategory": "Services"
  }'
```

## Testing Guide

### Quick Test

1. **Verify your phone number** in Twilio console (trial requirement)
2. **Trigger a call**:
   ```javascript
   fetch('/api/simulate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       phoneNumber: '+15551234567'  // YOUR verified number
     })
   })
   ```
3. **Answer the call** and have a real conversation!

### Conversation Test Scenarios

Test the AI's intelligence with these:

**✅ Natural Questions:**
- "How much does this cost?"
- "What exactly do you offer?"
- "How is this different from competitors?"
- "Can you tell me more about pricing?"

**✅ Objections:**
- "I'm not interested"
- "We already have a solution"
- "This isn't a good time"
- "I need to think about it"

**✅ Requests:**
- "Can I talk to a manager?"
- "Send me information by email"
- "Call me back next week"
- "What's your pricing for 100 users?"

**✅ Conversational Responses:**
- "Yeah, sure, I have a minute"
- "Maybe, what's this about?"
- "I don't know, what can you tell me?"

The AI should handle ALL of these naturally - no more "I didn't catch that" responses!

## How the AI Works

### System Prompt

The AI is given a detailed system prompt that defines its role:

```
You are a professional B2B sales representative making an outbound call.

CRITICAL RULES:
1. Keep responses SHORT - 1-2 sentences max
2. Answer questions DIRECTLY
3. Be HUMAN - use natural speech
4. Listen and respond to what they ACTUALLY say
5. If they're not interested, end the call politely
...
```

### Call Ending Logic

The AI can end calls in two ways:

1. **AI Decision**: AI responds with `[END_CALL]` prefix
   ```
   AI: "[END_CALL] No problem! Thanks for your time. Bye!"
   ```

2. **Turn Limit**: After 8 conversational turns
   ```javascript
   if (state.turnCount >= 8) {
     shouldEndCall = true;
   }
   ```

### Low Confidence Handling

If Twilio's speech recognition confidence is below 40%:
```javascript
if (confidence < 0.4) {
  return "Sorry, I didn't catch that. Could you say that again?";
}
```

### Silence Handling

If no speech detected:
```javascript
if (!speechResult) {
  return "I'm having trouble hearing you. Let me have someone call you back.";
  // End call gracefully
}
```

## Customization

### Adjust AI Personality

Edit the `SYSTEM_PROMPT` in `server/voice.ts`:

```typescript
const SYSTEM_PROMPT = `You are a [YOUR ROLE HERE].

RULES:
- [Your custom rules]
- [Your tone preferences]
...
`;
```

### Change AI Model

Switch to a more powerful model:

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',  // Changed from gpt-4o-mini
  ...
});
```

**Available models:**
- `gpt-4o-mini` - Fast, cost-effective (current)
- `gpt-4o` - More capable, higher quality
- `gpt-4.1` - Latest generation

### Adjust Response Length

Modify max tokens for longer/shorter responses:

```typescript
const completion = await openai.chat.completions.create({
  max_tokens: 150,  // Increase for longer responses
  ...
});
```

### Change Voice

Edit the voice in `buildTwiML()`:

```typescript
const voice = 'Polly.Joanna';  // Current
// const voice = 'Polly.Matthew';  // Male
// const voice = 'Polly.Salli';    // Alternative female
```

## Architecture

### Conversation State Management

Each call has state stored in memory:

```typescript
interface ConversationState {
  callSid: string;              // Twilio call identifier
  businessName: string;         // Business being called
  productCategory: string;      // Product type
  brandName: string;            // Your brand
  messages: Message[];          // Full conversation history
  turnCount: number;            // Number of exchanges
  hasGreeted: boolean;          // Greeting sent
}
```

### Message Flow

```
1. Twilio → /voice/start
   ↓
2. AI generates greeting
   ↓
3. TwiML with <Gather> sent back
   ↓
4. Caller speaks → Twilio transcribes
   ↓
5. Twilio → /voice/handle with SpeechResult
   ↓
6. AI generates contextual response
   ↓
7. TwiML with response + <Gather>
   ↓
8. Repeat steps 4-7 until call ends
```

### AI Request Structure

```javascript
{
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: SYSTEM_PROMPT + context },
    { role: 'assistant', content: 'Hi! This is...' },
    { role: 'user', content: 'How much does it cost?' },
    { role: 'assistant', content: 'Our pricing starts at...' },
    { role: 'user', content: 'What about for 50 users?' }
  ],
  temperature: 0.8,  // Creative but consistent
  max_tokens: 150    // Short responses
}
```

## Troubleshooting

### Issue: AI gives long, rambling responses
**Solution**: The system prompt emphasizes SHORT responses (1-2 sentences), but you can:
- Reduce `max_tokens` further
- Add more emphasis in system prompt
- Lower `temperature` for more focused responses

### Issue: AI doesn't end calls when it should
**Check**: System prompt includes `[END_CALL]` instructions
**Solution**: Make ending criteria more explicit in prompt

### Issue: "OpenAI API error"
**Check**: Environment variables are set:
```bash
echo $AI_INTEGRATIONS_OPENAI_API_KEY
echo $AI_INTEGRATIONS_OPENAI_BASE_URL
```
**Solution**: Replit AI Integrations should be auto-configured

### Issue: Poor speech recognition
**Not an AI issue** - this is Twilio's speech-to-text
**Solution**: 
- Ask caller to speak clearly
- Check phone connection quality
- Lower confidence threshold (currently 0.4)

### Issue: AI doesn't remember earlier conversation
**Check**: Conversation state exists in memory
**Solution**: Verify `conversations.get(callSid)` returns state

## Logs & Monitoring

Monitor AI conversations in real-time:

```
[Voice Start] CallSid: CAxxxx, To: +1xxx, Business: Acme Inc
[Voice Handle] CallSid: CAxxxx, Speech: "how much does it cost", Confidence: 0.89
[AI Response] Turn 2: "Our pricing starts at $99/month..." (shouldEnd: false)
[Voice Handle] CallSid: CAxxxx, Speech: "okay send me info", Confidence: 0.92
[AI Response] Turn 3: "Perfect! I'll text you the details right now." (shouldEnd: true)
```

## Billing & Costs

**Replit AI Integrations:**
- Uses your Replit credits
- No separate OpenAI API key needed
- Costs shown in your Replit dashboard

**Approximate costs per call:**
- 8-turn conversation: ~1,500 tokens
- Using gpt-4o-mini: Very low cost
- Twilio charges apply separately

## Next Steps & Ideas

**Enhancements to consider:**
- Add SMS follow-up after calls
- Store transcripts in database
- Analyze conversation quality
- A/B test different system prompts
- Add sentiment analysis
- Integrate with CRM
- Generate call summaries
- Train on your best sales calls

## Support

**The AI isn't working?**
1. Check logs for AI errors
2. Verify OpenAI integration is active
3. Test with `/api/simulate` endpoint
4. Review conversation state in logs

**Want to improve responses?**
- Adjust the `SYSTEM_PROMPT`
- Change model to `gpt-4o`
- Modify `temperature` setting
- Add more specific instructions

**Getting charged too much?**
- Use `gpt-4o-mini` (cheaper)
- Reduce `max_tokens`
- End calls sooner (lower turn limit)

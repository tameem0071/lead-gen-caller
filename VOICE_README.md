# ElevenLabs Ultra-Realistic Voice Integration

This application now features **ElevenLabs voices via Twilio ConversationRelay** - providing the most realistic, human-like AI phone conversations available today.

## 🎙️ Voice Quality - ElevenLabs Professional Voice

**Voice:** ElevenLabs "Adam" (`pNInz6obpgDQGcFmaJgB`)
- **Quality Level:** ElevenLabs Flash 2.5 (ultra-realistic neural voice)
- **Gender:** Professional male voice
- **Sound:** Indistinguishable from a real human - warm, natural, conversational
- **Latency:** 75ms model latency for real-time conversations
- **Technology:** State-of-the-art generative AI voice synthesis

**Key Advantages Over Previous System:**
- ✅ Sounds completely human - not robotic at all
- ✅ Natural emotional expressiveness
- ✅ Perfect pronunciation and pacing
- ✅ No SSML tuning required - just send plain text
- ✅ 1000+ voices available to choose from
- ✅ Multilingual support with accent variety

## 🤖 AI Intelligence - GPT-4 Brain

**Model:** GPT-4o (OpenAI's most capable model)
- Temperature: 1.0 (maximum natural variation)
- Max tokens: 100 (short, phone-appropriate responses)
- Real-time conversation understanding
- Context-aware responses
- No artificial conversation limits

**AI Personality: "Alex"**
- Casual, friendly, professional
- Brief responses (1-2 sentences)
- Uses natural filler words ("you know", "um", "like")
- Mirrors caller's energy
- Never sounds scripted or uses placeholder text

## Architecture

```
Caller → Twilio Voice → ConversationRelay → WebSocket Server
                              ↓
                        Speech-to-Text
                              ↓
                         GPT-4 Processing
                              ↓
                        Text-to-Speech (ElevenLabs)
                              ↓
                    Ultra-Realistic Voice → Caller
```

**What ConversationRelay Handles Automatically:**
- Speech-to-Text (STT) transcription
- Text-to-Speech (TTS) with ElevenLabs
- Session management
- Barge-in detection (caller can interrupt)
- Low-latency media streaming

**What Your Server Handles:**
- GPT-4 conversation logic
- Business context and rules
- Call flow management
- Response generation

## How It Works

### 1. Call Initiation

Test a call:
```javascript
fetch('https://your-repl.replit.dev/api/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '+971528301575',  // Your verified number
    businessName: 'Test Business',
    productCategory: 'Software Services',
    brandName: 'TechCo'
  })
}).then(r => r.json()).then(console.log)
```

### 2. Twilio Connects to ConversationRelay

TwiML response (`/voice/twiml`):
```xml
<Response>
  <Connect>
    <ConversationRelay 
      url="wss://your-domain/voice/relay?businessName=..."
      ttsProvider="ElevenLabs"
      voice="pNInz6obpgDQGcFmaJgB"
      dtmfDetection="true"
    />
  </Connect>
</Response>
```

### 3. WebSocket Conversation

The WebSocket handler receives/sends messages:

**Setup (when call connects):**
```json
{
  "type": "setup",
  "callSid": "CA...",
  "streamSid": "MZ..."
}
```

**AI sends greeting:**
```json
{
  "type": "text",
  "token": "Hey! This is Alex from TechCo. We got your info about Software Services. You got a minute?"
}
```

**User speaks:**
```json
{
  "type": "prompt",
  "voicePrompt": "Who is this?"
}
```

**AI responds:**
```json
{
  "type": "text",
  "token": "Oh hey! Yeah I'm with TechCo. We help businesses with software stuff. Got a sec?"
}
```

### 4. ElevenLabs Speaks

ConversationRelay automatically converts the AI's text into ultra-realistic speech using ElevenLabs and plays it to the caller.

## Conversation Example

**Greeting:**
```
AI: "Hey! This is Alex from TestCo. We got your info about cloud services. You got a minute?"
```

**User asks question:**
```
User: "Who is this?"
AI: "Oh hey! Yeah I'm with TestCo. We help businesses with cloud stuff. Got a sec?"
```

**User asks about pricing:**
```
User: "How much does it cost?"
AI: "Yeah so most clients end up around 500-1000 a month depending on what they need, you know?"
```

**User is busy:**
```
User: "I'm busy right now"
AI: "[END_CALL] No problem at all! I'll shoot you an email instead. Take care!"
```

## Why This Sounds Ultra-Realistic

### 1. **ElevenLabs Voice Technology**
- Generative AI voice synthesis
- Emotional expressiveness
- Perfect natural prosody
- Human-like pauses and rhythm

### 2. **GPT-4 Intelligence**
- Understands context and nuance
- Natural conversation flow
- Adaptive to caller's style
- Never sounds scripted

### 3. **No SSML Required**
- Just send plain text
- ElevenLabs handles all natural speech
- No complex tuning needed

### 4. **Real-Time Feel**
- 75ms model latency
- Barge-in support
- Natural interruptions
- Conversational pacing

## Changing the Voice

### Available Voice Options

To use a different voice, edit `server/voice.ts` and change the voice ID:

```typescript
<ConversationRelay 
  url="${wsUrl}"
  ttsProvider="ElevenLabs"
  voice="pNInz6obpgDQGcFmaJgB"  // ← Change this
  dtmfDetection="true"
/>
```

**Popular ElevenLabs Voices:**
- `pNInz6obpgDQGcFmaJgB` - Adam (current - professional male, US)
- `NYC9WEgkq1u4jiqBseQ9` - Amelia (British female, expressive)
- `XrExE9yKIg1WjnnlVkGX` - Another Adam variant
- Browse 1000+ voices: [Twilio Voice Configuration](https://www.twilio.com/docs/voice/conversationrelay/voice-configuration)

### Advanced Voice Tuning

Customize voice parameters:

Format: `VOICE_ID-MODEL-SPEED_STABILITY_SIMILARITY`

Example:
```typescript
voice="pNInz6obpgDQGcFmaJgB-flash_v2_5-1.05_0.85_0.9"
```

**Parameters:**
- **Speed:** 0.5-2.0 (default 1.0, try 1.05 for slight quickness)
- **Stability:** 0.0-1.0 (default 0.6, try 0.85 for consistent tone)
- **Similarity:** 0.0-1.0 (default 0.8, try 0.9 for maximum accuracy)

## Customizing the AI Personality

Edit `SYSTEM_PROMPT` in `server/voice.ts`:

```typescript
const SYSTEM_PROMPT = `You're Alex, calling on behalf of a company...

CRITICAL RULES:
1. Keep it SHORT - 1-2 sentences max per response
2. Sound NATURAL - use contractions, casual language
3. NO PLACEHOLDERS - Never say [Your Name] or [Company]
4. Be CONVERSATIONAL - like chatting with someone
5. MIRROR their energy - busy? Be brief. Chatty? Engage

...
`;
```

**Current Personality:**
- Friendly, professional but casual
- Brief responses (phone-appropriate)
- Uses filler words sparingly ("you know", "like")
- Adapts to caller's mood
- Never sounds robotic or scripted

## API Endpoints

### POST /voice/twiml
Returns TwiML that connects to ConversationRelay with ElevenLabs

**Query Parameters:**
- `businessName` - Name of the business being called
- `productCategory` - What product/service you're calling about
- `brandName` - Your company name

**Returns:** TwiML XML with ConversationRelay configuration

### WebSocket /voice/relay
Real-time conversation handling

**Message Types:**
- `setup` - Initialize conversation state
- `prompt` - User speech transcription
- `text` - AI response to speak
- `interrupt` - User interrupted AI
- `stop` - Conversation ended

## Testing

### Monitor Logs

Watch for:
```bash
[WebSocket] New connection to /voice/relay
[Setup] CallSid: CA..., Business: Test Business
[User Speech] "Who is this?"
[AI] Turn 1: "Oh hey! Yeah I'm with TestCo..." (end: false)
```

### What to Test

**Voice Quality:**
- Does it sound like a real person?
- Is the tone warm and professional?
- Are pauses natural?
- Is pronunciation perfect?

**AI Intelligence:**
- Ask: "How much does it cost?"
- Ask: "What do you do?"
- Say: "I'm busy"
- Ask: "Can you call back later?"

The AI should handle everything naturally!

**Conversation Flow:**
- AI should ask follow-ups
- Build on previous answers
- Mirror your energy
- End gracefully when appropriate

## Troubleshooting

### No audio / silence on call
- Check WebSocket logs for connection
- Verify voice ID is correct
- Ensure GPT-4 is responding (look for `[AI]` logs)
- Check Twilio debugger for errors

### Voice sounds robotic
- **This shouldn't happen with ElevenLabs!**
- Verify `ttsProvider="ElevenLabs"` is set
- Check voice ID is valid ElevenLabs voice
- Review Twilio ConversationRelay status

### AI gives bad responses
- Review `SYSTEM_PROMPT` in `server/voice.ts`
- Adjust temperature (currently 1.0)
- Modify max_tokens if responses cut off
- Check GPT-4 API status

### Call doesn't connect
- Phone number must be verified (Twilio trial mode)
- Check `/voice/twiml` endpoint is accessible
- Verify WebSocket endpoint is reachable
- Review Twilio call debugger

### WebSocket connection fails
- Ensure server supports WebSocket upgrades
- Verify firewall/proxy allows WebSocket
- Check REPLIT_DEV_DOMAIN is set correctly
- Test WebSocket endpoint separately

## Environment Variables

All managed automatically by Replit:

**OpenAI Integration:**
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`

**Twilio Integration:**
- Account SID, Auth Token, Phone Number
- Managed via Replit Connector

**Domain:**
- `REPLIT_DEV_DOMAIN` - Auto-configured

✅ No manual setup needed!

## Performance & Costs

**ElevenLabs TTS:**
- Included in Twilio ConversationRelay pricing
- Ultra-high quality voice
- 75ms latency

**GPT-4o:**
- Charged via Replit AI credits
- ~100 tokens per response
- Temperature 1.0 for natural variation

**Typical 5-Minute Call:**
- ~10-15 conversational turns
- ~1,000-1,500 GPT-4o tokens
- Very reasonable cost for quality

## Advantages Over Amazon Polly System

| Feature | Old (Polly) | New (ElevenLabs) |
|---------|-------------|------------------|
| **Voice Quality** | Neural TTS | Ultra-realistic generative AI |
| **Sound** | Somewhat robotic | Completely human |
| **Setup** | Complex SSML tuning | Just send plain text |
| **Voices** | Limited selection | 1000+ voices |
| **Expressiveness** | Limited | Emotional & natural |
| **Latency** | Good | Excellent (75ms) |
| **Ease** | Required prosody tweaking | Works out of the box |

## Production Deployment

When ready for production:

1. **Upgrade Twilio** - Remove trial number restrictions
2. **Add Error Handling** - Retry logic for API failures
3. **Monitor Costs** - Track ElevenLabs/GPT-4 usage
4. **Scale WebSocket** - Load balancing for high volume
5. **Add Analytics** - Conversation success metrics
6. **Test Extensively** - Various scenarios and questions

## Resources

- [Twilio ConversationRelay Docs](https://www.twilio.com/docs/voice/conversationrelay)
- [ElevenLabs Voice Library](https://www.twilio.com/docs/voice/conversationrelay/voice-configuration)
- [ConversationRelay Best Practices](https://www.twilio.com/docs/voice/conversationrelay/best-practices)
- [ElevenLabs + Twilio Tutorial](https://www.twilio.com/en-us/blog/integrate-elevenlabs-voices-with-twilios-conversationrelay)

---

## Summary

Your AI caller now sounds like a **real professional human** making a genuine phone call:

✅ **Ultra-realistic voice** - ElevenLabs generative AI
✅ **Intelligent conversations** - GPT-4o brain  
✅ **Natural flow** - No scripts, adaptive responses
✅ **Professional quality** - Perfect for B2B outreach
✅ **Easy to use** - No complex configuration

**Test it yourself and hear the difference!**

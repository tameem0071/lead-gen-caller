# Ultra-Realistic AI Voice Caller

This application features an **ultra-realistic AI-powered conversational caller** that uses OpenAI's GPT-4o and Amazon Polly's highest-quality Neural voice to have natural, engaging phone conversations with leads.

## 🎙️ Voice Quality - Professional Male Voice

**Voice:** Amazon Polly Matthew (Neural tier)
- **Quality Level:** Neural TTS (highest quality available on Twilio)
- **Gender:** Professional male voice
- **Sound:** Natural, warm, conversational
- **Technology:** Amazon Polly's neural engine with deep learning

**SSML Enhancements for Ultra-Realistic Speech:**
- Dynamic rate adjustments (98-102% variation)
- Subtle pitch lift (+3% for professional tone)
- Strategic 400ms pauses between sentences
- Natural pacing and rhythm
- Human-like speech patterns

## 🤖 AI Intelligence - No More Scripts

**Model:** GPT-4o (OpenAI's most capable model)
- Real language understanding
- Creative, engaging responses (temperature 0.9)
- Longer, more detailed answers (up to 250 tokens)
- Remembers full conversation context

**Conversation Style:**
- ✅ Asks follow-up questions naturally
- ✅ Shows genuine interest and listens
- ✅ Builds rapport and relationships
- ✅ Answers questions directly with specifics
- ✅ Varies responses - never sounds robotic
- ✅ No artificial time limits - conversations flow naturally

## Key Improvements from Basic System

| Feature | Old System | New Ultra-Realistic System |
|---------|-----------|---------------------------|
| **Voice** | Female standard voice | Professional male Neural voice |
| **Speech Quality** | Basic TTS | SSML prosody with natural pacing |
| **AI Model** | gpt-4o-mini | gpt-4o (highest quality) |
| **Response Style** | Short, scripted | Engaging, conversational |
| **Turn Limit** | 8 turns max | Unlimited - natural endings |
| **Questions** | Couldn't answer | Answers directly with details |
| **Engagement** | Robotic | Builds rapport, asks follow-ups |

## How It Works

### Ultra-Realistic Voice Pipeline

```
User speaks → Twilio transcribes
    ↓
GPT-4o generates intelligent response
    ↓
SSML prosody applied (rate, pitch, breaks)
    ↓
Amazon Polly Matthew (Neural) speaks
    ↓
Natural-sounding professional male voice
```

### SSML Prosody Magic

Every response is enhanced with SSML:

```xml
<speak>
  <prosody rate="102%" pitch="+3%">
    Hi! This is TechCo calling about Cloud Services.
  </prosody>
  <break time="400ms"/>
  <prosody rate="98%" pitch="+3%">
    We received your inquiry and wanted to reach out personally.
  </prosody>
  <break time="400ms"/>
  <prosody rate="98%" pitch="+3%">
    Do you have a quick moment to chat?
  </prosody>
</speak>
```

**Result:** Natural pauses, varied pacing, professional tone

### Conversation Example

**OLD SYSTEM:**
```
Caller: "How much does your service cost?"
Bot: "I didn't quite catch that. Are you interested in our services?"
❌ Doesn't understand
❌ Sounds robotic
❌ Can't answer questions
```

**NEW ULTRA-REALISTIC SYSTEM:**
```
Caller: "How much does your service cost?"
AI: "Great question! Our pricing typically ranges from $500 to $2,000 
     per month depending on your team size and needs. What size is 
     your organization?"

Caller: "We're about 50 people"
AI: "Perfect! For a 50-person team, you'd likely be looking at around 
     $1,200 per month. That includes all features and support. Would 
     you like me to send over a detailed breakdown via email?"
     
✅ Understands perfectly
✅ Gives real numbers
✅ Sounds human
✅ Asks relevant follow-ups
```

## AI System Prompt

The AI is instructed to be:

**Conversational and Warm:**
- Sound like a real person, not a robot
- Use natural speech with contractions
- Show genuine interest in their business

**Engaging:**
- Ask open-ended questions
- Build on previous answers
- Share relevant insights
- Keep the conversation flowing

**Helpful:**
- Answer questions directly with specifics
- Provide real numbers and details
- Be informative, not pushy

**No Rush:**
- Let conversations develop naturally
- No artificial turn limits
- End only when truly appropriate
- Focus on quality engagement

## Environment Setup

All credentials managed through Replit Connectors:

**Twilio:**
- Account SID, Auth Token, Phone Number

**OpenAI:**
- API Key (via Replit AI Integrations)

**Domain:**
- Automatically configured

✅ No manual setup needed!

## Testing Your Ultra-Realistic Caller

### Quick Test

```javascript
fetch('/api/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '+15551234567',  // YOUR verified number
    businessName: 'Acme Corp',
    productCategory: 'Cloud Services'
  })
})
```

### What to Test

**Voice Quality:**
- Listen for natural male voice
- Notice pauses between sentences
- Hear varied pacing (not monotone)
- Professional, warm tone

**AI Intelligence:**
- Ask: "How much does it cost?"
- Ask: "What makes you different?"
- Ask: "Can you tell me more about X?"
- Say: "I'm not sure, what can you tell me?"

The AI should handle ALL questions intelligently!

**Conversation Flow:**
- The AI will ask follow-up questions
- Build on your previous answers
- Show it's listening and engaged
- Not rush to end the call

## Advanced Configuration

### Adjust Prosody

Edit `addSSMLProsody()` in `server/voice.ts`:

```typescript
const rate = i === 0 ? '102%' : '98%';  // Speed variation
const pitch = '+3%';  // Pitch adjustment
```

**Recommendations:**
- Rate: 95-110% (subtle is better)
- Pitch: +2% to +5% for professional male
- Breaks: 300-500ms between sentences

### Change AI Personality

Edit `SYSTEM_PROMPT` in `server/voice.ts`:

```typescript
const SYSTEM_PROMPT = `You are a [YOUR ROLE].

CONVERSATION STYLE:
- [Your style preferences]
- [Your tone]

ENGAGEMENT TECHNIQUES:
- [Your approach]
...
`;
```

### Adjust Response Length

```typescript
max_tokens: 250,  // Increase for longer responses
```

### Change Voice

Other high-quality male voices:
```typescript
const voice = 'Polly.Matthew';  // Current (recommended)
// const voice = 'Polly.Justin';  // Young male
// const voice = 'Polly.Joey';    // Alternative male
```

## API Endpoints

### POST /voice/start
Initial AI greeting when call connects

**Returns:** TwiML with SSML-enhanced greeting

### POST /voice/handle
Ongoing AI conversation handler

**Process:**
1. Receive caller's speech
2. Send to GPT-4o with full context
3. Generate intelligent response
4. Apply SSML prosody
5. Return TwiML with enhanced voice

## Voice Quality Breakdown

**Amazon Polly Matthew (Neural):**
- ✅ Deep learning-based synthesis
- ✅ Natural prosody and intonation
- ✅ Contextual pronunciation
- ✅ Emotional warmth
- ✅ Professional business tone

**SSML Enhancements:**
- ✅ Rate variations prevent monotone
- ✅ Pitch lift adds energy
- ✅ Strategic breaks mimic human pauses
- ✅ Natural sentence flow
- ✅ Professional pacing

**GPT-4o Integration:**
- ✅ Understands context and nuance
- ✅ Generates varied, natural responses
- ✅ Remembers conversation history
- ✅ Adapts to caller's style
- ✅ Shows genuine engagement

## Troubleshooting

### Voice sounds robotic
- **Unlikely** - Neural voice + SSML should sound very natural
- **Check**: Verify SSML is working in logs
- **Adjust**: Increase rate/pitch variations

### AI responses too long
- **Solution**: Reduce `max_tokens` (currently 250)
- **Or**: Update system prompt to emphasize brevity

### AI responses too short
- **Solution**: Increase `max_tokens` 
- **Or**: Update prompt to encourage detail

### Conversations end too quickly
- **Already fixed** - No turn limit
- **Check**: System prompt has correct ending instructions

### Voice doesn't sound professional enough
- **Current**: Polly.Matthew is already professional
- **Try**: Adjust pitch (+2% to +5%)
- **Or**: Modify SSML rate (98-102%)

## Performance & Costs

**Voice Quality:** Neural tier ($0.0032/100 chars)
- Higher quality than Standard
- Same price as basic Neural
- SSML adds no extra cost

**AI Model:** GPT-4o via Replit AI Integrations
- Charged to Replit credits
- More expensive than gpt-4o-mini
- Worth it for quality conversations

**Typical Call:**
- 5-10 minute conversation
- ~3,000 tokens (GPT-4o)
- ~500 characters (voice synthesis)
- Very reasonable cost for quality

## Why This Sounds Ultra-Realistic

1. **Neural Voice Technology**
   - Deep learning synthesis
   - Natural prosody
   - Emotional warmth

2. **SSML Prosody**
   - Varied pacing (not monotone)
   - Strategic pauses
   - Professional tone

3. **GPT-4o Intelligence**
   - Real understanding
   - Natural conversation flow
   - Contextual responses

4. **No Scripts**
   - Adapts to each caller
   - Never sounds canned
   - Genuine engagement

5. **Unlimited Conversation**
   - No rush to end
   - Natural flow
   - Time to build rapport

## Next Steps

1. **Test the voice** - Call yourself and listen
2. **Adjust prosody** - Fine-tune rate/pitch if needed
3. **Refine AI prompt** - Customize personality
4. **Monitor conversations** - Check logs for quality
5. **Deploy to production** - Use with real leads

Your caller now sounds like a **real professional businessperson** making a genuine call. No more robotic scripts!

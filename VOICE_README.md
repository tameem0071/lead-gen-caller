# Conversational Voice System

This application now includes a conversational AI voice system that uses Twilio's speech recognition to have natural, interactive phone calls with leads.

## Features

- **Natural conversation flow** with speech-based interaction
- **Intent recognition** for yes/no, pricing inquiries, scheduling, and objection handling
- **Silence handling** with up to 2 gentle reprompts
- **Machine detection** to avoid leaving voicemails
- **Amazon Polly "Joanna" voice** for natural-sounding speech
- **Multi-stage conversation** that adapts based on user responses

## Environment Setup

### Required Environment Variables

The system automatically reads Twilio credentials from your Replit connector. Additionally, ensure these environment variables are set:

- `REPLIT_DEV_DOMAIN` - Automatically provided by Replit (e.g., `your-app.repl.co`)
- `PUBLIC_BASE_URL` - (Optional) Override if using custom domain

### Twilio Configuration

1. **Connect Twilio** via Replit Connectors (already done)
2. **Verify your phone number** in Twilio console (required for trial mode)
3. **Note your Twilio phone number** from the connector settings

## How It Works

### Conversation Flow

1. **Greeting Stage**
   - AI introduces itself with brand and product
   - Asks if the lead has time to chat
   - Handles affirmative, negative, or scheduling responses

2. **Interest Check Stage**
   - If interested, offers more information
   - Can transition to pricing or scheduling

3. **Pricing Stage**
   - Discusses pricing options
   - Offers to send details via text

4. **Closing Stage**
   - Thanks the lead
   - Confirms next steps
   - Ends call gracefully

### Intent Recognition

The system recognizes these intents:
- **Affirmative**: yes, yeah, sure, absolutely, interested
- **Negative**: no, not interested, no thanks, stop
- **Pricing Inquiry**: price, cost, how much, expensive
- **Schedule Follow-up**: call back, later, another time, busy
- **Transfer Request**: owner, manager, decision maker

### Silence & Low Confidence Handling

- **Silence detected**: System reprompts once, then twice before gracefully ending
- **Low confidence (<0.5)**: Treats as unclear and asks user to repeat
- **Maximum retries**: 2 attempts before switching to text follow-up

## API Endpoints

### Voice Routes (Twilio Webhooks)

#### `POST /voice/start`
Initial greeting and first question. Called by Twilio when the call connects.

**Parameters** (passed via URL):
- `businessName` - Company name from lead
- `productCategory` - Product/service category
- `brandName` - Brand to mention in greeting

**Returns**: TwiML with greeting and speech gather

#### `POST /voice/handle`
Handles speech responses and continues conversation.

**Parameters** (from Twilio webhook):
- `CallSid` - Unique call identifier
- `SpeechResult` - Transcribed speech from user
- `Confidence` - Recognition confidence (0-1)

**Returns**: TwiML with contextual response and next gather

### Test Endpoint

#### `POST /api/simulate`
Easy way to trigger test calls.

**Request Body**:
```json
{
  "phoneNumber": "+15005550006",  // Optional, defaults to Twilio test number
  "businessName": "Test Corp",     // Optional
  "productCategory": "Services",   // Optional
  "brandName": "TestBrand"        // Optional
}
```

**Example**:
```bash
curl -X POST https://your-app.repl.co/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+15551234567","businessName":"Acme Inc"}'
```

## Testing Checklist

### Development Testing

- [ ] Set up Twilio connector in Replit
- [ ] Verify your test phone number in Twilio console
- [ ] Test the `/api/simulate` endpoint with your verified number
- [ ] Check admin dashboard to see call session created
- [ ] Answer the call and test conversation flow

### Conversation Testing

Test each conversation path:

- [ ] **Happy path**: Answer "yes" → "yes" → confirm pricing
- [ ] **Not interested**: Answer "no" → call ends gracefully
- [ ] **Pricing inquiry**: Ask "how much does it cost?" → get pricing response
- [ ] **Schedule later**: Say "call back later" → graceful exit
- [ ] **Silence handling**: Don't respond → system reprompts → reprompts again → exits
- [ ] **Low confidence**: Mumble or unclear speech → system asks to repeat

### Trial Mode Considerations

When using Twilio trial mode:
- ✅ Calls to **verified numbers** will work
- ❌ Calls to **unverified numbers** will fail with error 21219
- The system handles these errors gracefully and logs them
- Consider upgrading Twilio account for production use

## Voice Quality Configuration

The system uses **Amazon Polly "Joanna"** voice (`Polly.Joanna`) which provides:
- Natural prosody and intonation
- Clear pronunciation
- Professional tone

### Alternative Voices

To change the voice, edit `server/voice.ts` and modify the `voice` variable:

```typescript
const voice = 'Polly.Joanna';  // Current (recommended)
// const voice = 'Polly.Matthew';  // Male voice
// const voice = 'Polly.Salli';    // Alternative female
// const voice = 'alice';          // Classic Twilio voice
```

## Troubleshooting

### Issue: Calls not connecting
- **Check**: Twilio connector is set up and phone number is configured
- **Check**: `REPLIT_DEV_DOMAIN` is set correctly
- **Solution**: Test with `/api/simulate` endpoint first

### Issue: "Number not verified" error
- **Cause**: Twilio trial mode restrictions
- **Solution**: Verify the destination number in Twilio console
- **Or**: Upgrade to paid Twilio account

### Issue: Poor speech recognition
- **Cause**: Background noise or unclear speech
- **Solution**: System will reprompt up to 2 times
- **Check**: Twilio speech hints are configured correctly

### Issue: Call drops immediately
- **Cause**: Machine detection might have detected voicemail
- **Solution**: This is expected behavior to avoid leaving voicemails
- **Alternative**: Disable machine detection by removing `machineDetection: 'Enable'`

## Logs

The system provides detailed logging:

```
[Voice Start] CallSid: CAxxxx, To: +1xxx, From: +1xxx, Business: Acme Inc
[Voice Handle] CallSid: CAxxxx, Speech: "yes I'm interested", Confidence: 0.95
[Voice Handle] Detected intent: affirmative (confidence: 0.95)
```

Check the application logs to debug conversation flow and speech recognition.

## Architecture Notes

### Conversation State
- Stored in-memory keyed by Twilio `CallSid`
- Automatically cleaned up after call ends
- Tracks: stage, attempts, responses, detected intents

### Speech Recognition
- Uses Twilio's built-in speech recognition
- Configurable hints for better accuracy
- Auto timeout after 5 seconds of silence
- Profanity filter disabled for natural business conversation

### TwiML Generation
- Dynamic based on conversation stage and intent
- Includes both voice output (`<Say>`) and input gathering (`<Gather>`)
- Graceful fallbacks for silence and errors

## Next Steps

Consider these enhancements:
- Add SMS follow-up after call completion
- Store conversation transcripts in database
- Implement webhook handlers for real-time call status updates
- Add advanced analytics dashboard with success rates
- Integrate with CRM systems

## Support

For issues or questions:
1. Check the application logs in Replit
2. Review Twilio console for call details
3. Test with the `/api/simulate` endpoint
4. Verify environment variables are set correctly

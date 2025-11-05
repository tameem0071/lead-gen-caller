import type { WebSocket } from 'ws';
import OpenAI from 'openai';
import { ElevenLabsClient } from 'elevenlabs';
import { Readable } from 'stream';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// Ultra-realistic voice settings
const VOICE_SETTINGS = {
  stability: 0.65,           // Balanced - not too monotone, not too variable
  similarity_boost: 0.9,     // High adherence to Brian's voice
  style: 0.35,               // Subtle style exaggeration for natural expressiveness
  use_speaker_boost: true,   // Enhanced clarity
};

const BRIAN_VOICE_ID = 'N2lVS1w4EtoT3dr4eOWO'; // Deep, professional male voice

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MediaStreamState {
  callSid: string;
  streamSid: string;
  businessName: string;
  productCategory: string;
  brandName: string;
  messages: Message[];
  turnCount: number;
  ws: WebSocket;
  audioBuffer: Buffer[];
  isProcessing: boolean;
  lastProcessedTime: number;
}

const conversations = new Map<string, MediaStreamState>();

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

// Convert μ-law (ulaw) audio to PCM16 for Whisper
// Canonical ITU-T G.711 μ-law decoding algorithm
function ulawToPCM16(ulawBuffer: Buffer): Buffer {
  const pcm16Buffer = Buffer.alloc(ulawBuffer.length * 2);
  const BIAS = 132;
  
  for (let i = 0; i < ulawBuffer.length; i++) {
    // Step 1: Invert all bits (standard G.711 requirement)
    let ulaw = (~ulawBuffer[i]) & 0xFF;
    
    // Step 2: Extract components (seeemmmm format)
    const sign = (ulaw & 0x80) !== 0;
    const exponent = (ulaw >> 4) & 0x07;
    let mantissa = ulaw & 0x0F;
    
    // Step 3: Add implicit fifth bit (leading 1)
    mantissa |= 0x10;
    
    // Step 4: Calculate linear value
    // Formula: ((mantissa << 1) + 1) << (exponent + 2)
    let value = ((mantissa << 1) + 1) << (exponent + 2);
    
    // Step 5: Subtract BIAS (132)
    value -= BIAS;
    
    // Step 6: Apply sign
    const sample = sign ? -value : value;
    
    // Store as 16-bit PCM
    pcm16Buffer.writeInt16LE(sample, i * 2);
  }
  
  return pcm16Buffer;
}

// Convert PCM16 audio to μ-law for Twilio
function pcm16ToUlaw(pcm16Buffer: Buffer): Buffer {
  const ulawBuffer = Buffer.alloc(pcm16Buffer.length / 2);
  
  for (let i = 0; i < pcm16Buffer.length; i += 2) {
    let sample = pcm16Buffer.readInt16LE(i);
    const sign = sample < 0 ? 0x80 : 0x00;
    
    if (sign) sample = -sample;
    sample = Math.min(32635, sample + 132);
    
    let exponent = 7;
    for (let exp = 0; exp < 8; exp++) {
      if (sample <= (132 << exp)) {
        exponent = exp;
        break;
      }
    }
    
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    const ulaw = ~(sign | (exponent << 4) | mantissa);
    
    ulawBuffer[i / 2] = ulaw & 0xFF;
  }
  
  return ulawBuffer;
}

// Add WAV header to raw PCM16 audio
function createWAVBuffer(pcm16Buffer: Buffer, sampleRate: number = 8000): Buffer {
  const numChannels = 1; // Mono
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm16Buffer.length;
  const headerSize = 44;
  
  const wavBuffer = Buffer.alloc(headerSize + dataSize);
  
  // RIFF header
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + dataSize, 4);
  wavBuffer.write('WAVE', 8);
  
  // fmt chunk
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  wavBuffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(blockAlign, 32);
  wavBuffer.writeUInt16LE(bitsPerSample, 34);
  
  // data chunk
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(dataSize, 40);
  pcm16Buffer.copy(wavBuffer, 44);
  
  return wavBuffer;
}

async function transcribeAudio(pcm16Audio: Buffer): Promise<string> {
  try {
    // Wrap PCM16 audio in WAV container
    const wavBuffer = createWAVBuffer(pcm16Audio, 8000);
    
    // Create a readable stream with proper file metadata
    const audioStream = Readable.from(wavBuffer);
    (audioStream as any).path = 'audio.wav'; // Add filename hint
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream as any,
      model: 'whisper-1',
      language: 'en',
    });
    
    return transcription.text.trim();
  } catch (error) {
    console.error('[Whisper Error]', error);
    return '';
  }
}

async function generateAIResponse(
  state: MediaStreamState,
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

async function generateSpeechWithElevenLabs(text: string): Promise<Buffer> {
  try {
    console.log('[ElevenLabs] Generating speech:', text);
    
    const audioStream = await elevenlabs.textToSpeech.convert(BRIAN_VOICE_ID, {
      text,
      model_id: 'eleven_turbo_v2_5', // High quality, low latency
      voice_settings: VOICE_SETTINGS,
    });

    // Collect stream into buffer
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    
    const mp3Buffer = Buffer.concat(chunks);
    console.log('[ElevenLabs] Generated audio:', mp3Buffer.length, 'bytes');
    
    return mp3Buffer;
  } catch (error) {
    console.error('[ElevenLabs Error]', error);
    throw error;
  }
}

// Convert MP3 to μ-law 8kHz mono using ffmpeg
async function convertMP3ToUlaw(mp3Buffer: Buffer): Promise<Buffer> {
  const ffmpeg = require('fluent-ffmpeg');
  const { PassThrough } = require('stream');
  
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const inputStream = new PassThrough();
    const outputStream = new PassThrough();
    
    // Write MP3 data to input stream
    inputStream.end(mp3Buffer);
    
    ffmpeg(inputStream)
      .inputFormat('mp3')
      .audioCodec('pcm_mulaw')
      .audioFrequency(8000)
      .audioChannels(1)
      .format('mulaw')
      .on('error', (err: Error) => {
        console.error('[Audio Conversion Error]', err);
        reject(err);
      })
      .on('end', () => {
        const ulawBuffer = Buffer.concat(chunks);
        console.log('[Audio Conversion] MP3 → μ-law:', ulawBuffer.length, 'bytes');
        resolve(ulawBuffer);
      })
      .pipe(outputStream);
    
    outputStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    outputStream.on('end', () => {
      if (chunks.length === 0) {
        reject(new Error('No audio data produced by ffmpeg'));
      }
    });
  });
}

async function sendAudioToTwilio(ws: WebSocket, streamSid: string, audioBuffer: Buffer) {
  try {
    // Convert audio to μ-law format
    const ulawAudio = await convertMP3ToUlaw(audioBuffer);
    
    // Send audio in chunks (20ms = 160 bytes of μ-law @ 8kHz)
    const CHUNK_SIZE = 160; // 20ms of audio at 8kHz
    
    for (let i = 0; i < ulawAudio.length; i += CHUNK_SIZE) {
      // Extract raw 160-byte chunk
      const rawChunk = ulawAudio.slice(i, i + CHUNK_SIZE);
      
      // Encode this specific chunk to base64
      const base64Chunk = rawChunk.toString('base64');
      
      ws.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: {
          payload: base64Chunk,
        },
      }));
      
      // Small delay to match real-time playback (20ms per chunk)
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    
    console.log('[Twilio] Audio sent successfully:', ulawAudio.length, 'bytes in', Math.ceil(ulawAudio.length / CHUNK_SIZE), 'chunks');
  } catch (error) {
    console.error('[Send Audio Error]', error);
  }
}

export function handleMediaStreamWebSocket(ws: WebSocket, req: any) {
  console.log('[Media Stream] ✅ New connection');
  
  const url = req.url || '';
  const urlParams = new URLSearchParams(url.split('?')[1] || '');
  const businessName = urlParams.get('businessName') || 'your business';
  const productCategory = urlParams.get('productCategory') || 'our services';
  const brandName = urlParams.get('brandName') || 'the company';
  
  let state: MediaStreamState | undefined;
  
  ws.on('message', async (message: any) => {
    try {
      const data = JSON.parse(message.toString());
      const eventType = data.event;
      
      if (eventType === 'start') {
        const callSid = data.start.callSid;
        const streamSid = data.start.streamSid;
        
        state = {
          callSid,
          streamSid,
          businessName,
          productCategory,
          brandName,
          messages: [],
          turnCount: 0,
          ws,
          audioBuffer: [],
          isProcessing: false,
          lastProcessedTime: Date.now(),
        };
        
        conversations.set(callSid, state);
        
        console.log(`[Media Stream] Started - CallSid: ${callSid}, StreamSid: ${streamSid}`);
        
        // Send greeting
        const greeting = `Hello, this is Alex calling from ${brandName}. I'm reaching out regarding ${productCategory}. Do you have a moment to talk?`;
        
        state.messages.push({
          role: 'assistant',
          content: greeting,
        });
        
        const audioBuffer = await generateSpeechWithElevenLabs(greeting);
        await sendAudioToTwilio(ws, streamSid, audioBuffer);
        
      } else if (eventType === 'media' && state) {
        // Incoming audio from caller
        const audioPayload = data.media.payload;
        const ulawBuffer = Buffer.from(audioPayload, 'base64');
        
        state.audioBuffer.push(ulawBuffer);
        
        // Process audio when we have enough (e.g., 2 seconds = 16000 bytes at 8kHz)
        const totalBufferSize = state.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
        const timeSinceLastProcess = Date.now() - state.lastProcessedTime;
        
        if (totalBufferSize >= 16000 && !state.isProcessing && timeSinceLastProcess > 2000) {
          state.isProcessing = true;
          state.lastProcessedTime = Date.now();
          
          // Combine all buffered audio
          const combinedUlaw = Buffer.concat(state.audioBuffer);
          state.audioBuffer = [];
          
          // Convert to PCM16 for Whisper
          const pcm16Audio = ulawToPCM16(combinedUlaw);
          
          // Transcribe
          const userSpeech = await transcribeAudio(pcm16Audio);
          
          if (userSpeech) {
            console.log(`[User Speech] "${userSpeech}"`);
            
            // Generate AI response
            const { message, shouldEndCall } = await generateAIResponse(state, userSpeech);
            
            // Convert to speech
            const audioBuffer = await generateSpeechWithElevenLabs(message);
            
            // Send to caller
            await sendAudioToTwilio(ws, state.streamSid, audioBuffer);
            
            if (shouldEndCall) {
              setTimeout(() => {
                ws.send(JSON.stringify({ event: 'stop', streamSid: state!.streamSid }));
                ws.close();
              }, 2000);
            }
          }
          
          state.isProcessing = false;
        }
        
      } else if (eventType === 'stop') {
        console.log('[Media Stream] Call ended');
        if (state) {
          conversations.delete(state.callSid);
        }
      }
    } catch (error) {
      console.error('[Media Stream Error]', error);
    }
  });
  
  ws.on('close', () => {
    console.log('[Media Stream] Connection closed');
    if (state) {
      conversations.delete(state.callSid);
    }
  });
  
  ws.on('error', (error) => {
    console.error('[Media Stream WebSocket Error]', error);
  });
}

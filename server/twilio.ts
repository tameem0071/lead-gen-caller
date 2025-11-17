import twilio from 'twilio';

let connectionSettings: any;

async function getCredentials() {
  // Check if running on Replit with connector system
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  // Try Replit connector first
  if (hostname && xReplitToken) {
    try {
      connectionSettings = await fetch(
        'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
        {
          headers: {
            'Accept': 'application/json',
            'X_REPLIT_TOKEN': xReplitToken
          }
        }
      ).then(res => res.json()).then(data => data.items?.[0]);

      if (connectionSettings?.settings) {
        return {
          accountSid: connectionSettings.settings.account_sid,
          apiKey: connectionSettings.settings.api_key,
          apiKeySecret: connectionSettings.settings.api_key_secret,
          authToken: connectionSettings.settings.auth_token,
          phoneNumber: connectionSettings.settings.phone_number
        };
      }
    } catch (error) {
      console.log('Replit connector not available, falling back to environment variables');
    }
  }

  // Fallback to environment variables (for Render, Fly.io, Railway, etc.)
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !apiKey || !apiKeySecret) {
    throw new Error('Twilio credentials not found. Set TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, and TWILIO_API_KEY_SECRET environment variables.');
  }

  return {
    accountSid,
    apiKey,
    apiKeySecret,
    authToken,
    phoneNumber
  };
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, {
    accountSid: accountSid
  });
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

export async function getTwilioAuthToken() {
  // Use environment variable for auth token (required for WebSocket signature validation)
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    throw new Error('TWILIO_AUTH_TOKEN not found in environment variables');
  }
  return authToken;
}

export function generateTwiML(businessName: string, productCategory: string, brandName: string): string {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    Hi, this is ${brandName} reaching out about ${productCategory}. 
    We received your interest and wanted to introduce ourselves. 
    Thank you for your time, and we'll follow up with more details shortly.
  </Say>
  <Pause length="1"/>
  <Say voice="alice">
    Have a great day!
  </Say>
</Response>`;
  
  return twiml;
}

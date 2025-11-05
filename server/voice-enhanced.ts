import { Router } from 'express';
import type { Request, Response } from 'express';
import { handleMediaStreamWebSocket } from './voice-media-streams';

const router = Router();

// TwiML endpoint for Media Streams integration
const handleTwiMLMediaStreams = (req: Request, res: Response) => {
  const businessName = req.query.businessName as string || 'Test Business';
  const productCategory = req.query.productCategory as string || 'Test Services';
  const brandName = req.query.brandName as string || 'TestCo';

  const wsUrl = `wss://${process.env.REPLIT_DEV_DOMAIN || 'your-repl-url.replit.dev'}/voice/media-stream?businessName=${encodeURIComponent(businessName)}&productCategory=${encodeURIComponent(productCategory)}&brandName=${encodeURIComponent(brandName)}`;

  // XML-escape the URL for TwiML (& must be &amp; in XML)
  const xmlSafeUrl = wsUrl.replace(/&/g, '&amp;');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${xmlSafeUrl}" />
  </Connect>
</Response>`;

  console.log(`[TwiML Media Streams] ${req.method} request - Connecting to: ${wsUrl}`);
  res.type('text/xml').send(twiml);
};

router.get('/twiml-enhanced', handleTwiMLMediaStreams);
router.post('/twiml-enhanced', handleTwiMLMediaStreams);

export { handleMediaStreamWebSocket };
export default router;

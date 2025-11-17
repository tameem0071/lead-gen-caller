/**
 * Get the public hostname for this deployment
 * Works across Render, Replit, and local development
 */
export function getPublicHostname(): string | null {
  // Render provides RENDER_EXTERNAL_URL (full URL like https://myapp.onrender.com)
  if (process.env.RENDER_EXTERNAL_URL) {
    try {
      const url = new URL(process.env.RENDER_EXTERNAL_URL);
      return url.hostname;
    } catch {
      console.error('[Hostname] Invalid RENDER_EXTERNAL_URL:', process.env.RENDER_EXTERNAL_URL);
    }
  }

  // Render also provides RENDER_EXTERNAL_HOSTNAME (just the hostname)
  if (process.env.RENDER_EXTERNAL_HOSTNAME) {
    return process.env.RENDER_EXTERNAL_HOSTNAME;
  }

  // Replit provides just the hostname
  if (process.env.REPLIT_DEV_DOMAIN) {
    return process.env.REPLIT_DEV_DOMAIN;
  }

  // Check for explicit PUBLIC_BASE_URL (works in all environments)
  if (process.env.PUBLIC_BASE_URL) {
    try {
      // Try parsing as URL first
      const url = new URL(process.env.PUBLIC_BASE_URL);
      return url.hostname;
    } catch {
      // If not a URL, treat as hostname directly
      return process.env.PUBLIC_BASE_URL.replace(/^https?:\/\//, '');
    }
  }

  // Final fallback: localhost for local development
  // Note: Don't hardcode port - let infrastructure handle default ports
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || '5000';
    return `localhost:${port}`;
  }

  return null;
}

/**
 * Get the full public URL (with https://)
 */
export function getPublicUrl(): string | null {
  const hostname = getPublicHostname();
  if (!hostname) return null;
  
  // Local development might use HTTP
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return `http://${hostname}`;
  }
  
  // Production always uses HTTPS
  return `https://${hostname}`;
}

/**
 * Get WebSocket URL (ws:// for localhost, wss:// for production)
 */
export function getWebSocketUrl(path: string): string | null {
  const hostname = getPublicHostname();
  if (!hostname) return null;
  
  // Determine protocol
  const protocol = (hostname.includes('localhost') || hostname.includes('127.0.0.1')) ? 'ws://' : 'wss://';
  
  // Use URL constructor for proper path handling (handles query strings, relative paths, etc.)
  // Trailing slash in base ensures relative paths resolve correctly
  try {
    const baseUrl = `${protocol}//${hostname}/`;
    const url = new URL(path, baseUrl);
    return url.toString();
  } catch (error) {
    console.error('[WebSocket URL] Invalid path:', path, error);
    return null;
  }
}

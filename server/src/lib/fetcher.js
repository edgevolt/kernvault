const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const DEFAULT_TIMEOUT_MS = 12000;

// Block private/loopback ranges to prevent SSRF
const PRIVATE_IP_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fc00:|fe80:)/i;

function validateUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch {
    throw { code: 'FETCH_FAILED', message: 'Invalid URL.' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw { code: 'FETCH_FAILED', message: 'Only HTTP and HTTPS URLs are supported.' };
  }
  if (PRIVATE_IP_RE.test(parsed.hostname)) {
    throw { code: 'FETCH_FAILED', message: 'Requests to private or local addresses are not allowed.' };
  }
}

const USER_AGENT =
  'Mozilla/5.0 (compatible; Kernvault/1.0; +https://github.com/kernvault)';

/**
 * Fetch a URL and extract readable article content via Mozilla Readability.
 *
 * @param {string} url - The URL to fetch.
 * @returns {{ title: string, content_html: string, content_text: string, byline: string|null }}
 * @throws {{ code: string, message: string }}
 */
async function fetchAndParse(url) {
  validateUrl(url);

  let html;

  try {
    const response = await axios.get(url, {
      timeout: DEFAULT_TIMEOUT_MS,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      maxRedirects: 5,
      // Treat all status codes as resolved so we can inspect them
      validateStatus: () => true,
    });

    if (response.status === 404) {
      throw { code: 'NOT_FOUND', message: `The page returned a 404 Not Found error.` };
    }
    if (response.status === 403 || response.status === 401) {
      throw { code: 'ACCESS_DENIED', message: `The page is behind a login or paywall (HTTP ${response.status}).` };
    }
    if (response.status >= 400) {
      throw { code: 'FETCH_FAILED', message: `The server returned HTTP ${response.status}.` };
    }

    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('html')) {
      throw { code: 'NOT_HTML', message: `The URL does not point to an HTML page (Content-Type: ${contentType}).` };
    }

    html = response.data;
  } catch (err) {
    if (err.code && err.message && !err.isAxiosError) {
      throw err; // re-throw our structured errors
    }
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      throw { code: 'TIMEOUT', message: `The request timed out after ${DEFAULT_TIMEOUT_MS / 1000} seconds.` };
    }
    throw { code: 'FETCH_FAILED', message: err.message || 'Could not fetch the URL.' };
  }

  // Parse with Readability
  try {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // Apply global and domain-specific HTML cleanup rules
    const { applyParsingRules } = require('./parserRegistry');
    applyParsingRules(doc, url);

    const reader = new Readability(doc);
    const article = reader.parse();

    if (!article) {
      throw { code: 'PARSE_FAILED', message: 'Could not extract readable content from this page.' };
    }

    return {
      title: article.title || '',
      content_html: article.content || '',
      content_text: article.textContent || '',
      byline: article.byline || null,
    };
  } catch (err) {
    if (err.code && err.message) throw err;
    throw { code: 'PARSE_FAILED', message: 'Failed to parse the page content.' };
  }
}

module.exports = { fetchAndParse };

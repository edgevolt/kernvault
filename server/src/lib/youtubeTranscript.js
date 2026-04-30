'use strict';

/**
 * Fetches a YouTube transcript using the InnerTube (youtubei) API.
 * Uses axios (already a project dependency) — no extra packages needed.
 *
 * Returns an array of { offset: ms, duration: ms, text: string }
 */

const axios = require('axios');

const VIDEO_ID_REGEX =
  /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;

const ANDROID_UA =
  'com.google.android.youtube/20.10.38 (Linux; U; Android 14)';

const INNERTUBE_ENDPOINT =
  'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';

function extractVideoId(url) {
  if (url && url.length === 11) return url;
  const m = url && url.match(VIDEO_ID_REGEX);
  if (m) return m[1];
  throw new Error('Could not extract a valid YouTube video ID from the URL.');
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

/**
 * @param {string} url  - Full YouTube URL or bare 11-char video ID
 * @param {string} [lang='en'] - Preferred language code (falls back to first available track)
 * @returns {Promise<Array<{offset: number, duration: number, text: string}>>}
 */
async function fetchYouTubeTranscript(url, lang = 'en') {
  const videoId = extractVideoId(url);

  // Step 1: Hit the InnerTube player endpoint with an Android client identity
  const playerRes = await axios.post(
    INNERTUBE_ENDPOINT,
    {
      context: {
        client: { clientName: 'ANDROID', clientVersion: '20.10.38' },
      },
      videoId,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ANDROID_UA,
      },
      timeout: 12000,
    }
  );

  const tracks =
    playerRes.data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error('No caption tracks found. Ensure the video has captions enabled.');
  }

  // Step 2: Prefer requested language, fall back to first available track
  const track = tracks.find(t => t.languageCode === lang) || tracks[0];

  // Step 3: Fetch the timed-text XML
  const xmlRes = await axios.get(track.baseUrl, { timeout: 12000 });
  const xml = xmlRes.data;

  // Step 4: Parse <p t="offset_ms" d="duration_ms">…</p> (timedtext format=3)
  const items = [];
  const re = /<p t="(\d+)" d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const text = decodeEntities(m[3].replace(/<[^>]+>/g, '')).trim();
    if (text) {
      items.push({
        offset: parseInt(m[1], 10),    // milliseconds from video start
        duration: parseInt(m[2], 10),  // milliseconds
        text,
      });
    }
  }

  if (items.length === 0) {
    throw new Error('Transcript was found but contained no readable text.');
  }

  return items;
}

module.exports = { fetchYouTubeTranscript };

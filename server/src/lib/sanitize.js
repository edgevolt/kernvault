const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const _purify = createDOMPurify(new JSDOM('').window);

function sanitizeHtml(dirty) {
  return _purify.sanitize(dirty ?? '', { USE_PROFILES: { html: true } });
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sanitizeHtml, escHtml };

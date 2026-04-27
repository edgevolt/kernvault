/**
 * A registry of domain-specific parsing rules to clean up noisy elements
 * before handing the document over to Mozilla Readability.
 */

const globalNoiseSelectors = [
  // Semantic tags that usually contain noise
  'aside',
  'nav',
  'footer',
  'header',
  // Common aria roles for non-content
  '[role="complementary"]',
  '[role="navigation"]',
  '[role="banner"]',
  // Common noise classes
  '[class*="sidebar"]',
  '[class*="advertisement"]',
  '[class*="social-share"]',
  '[class*="newsletter"]'
];

const domainRules = [
  {
    // Matches any wikipedia.org subdomain
    match: (hostname) => hostname.endsWith('wikipedia.org'),
    selectorsToRemove: [
      '.infobox',
      '.navbox',
      '.mw-editsection',
      '.reference',
      '.reflist',
      '.metadata',
      '.noprint',
      '.portal'
    ],
    // Optional custom function for more complex DOM manipulation
    preProcess: (doc) => {
      // Example: could do more specific Wikipedia cleanups here if needed
    }
  },
  // Example for future:
  // {
  //   match: (hostname) => hostname.endsWith('medium.com'),
  //   selectorsToRemove: ['.meteredContent', '.js-stickyFooter']
  // }
];

/**
 * Apply both global heuristics and domain-specific rules to the given JSDOM document.
 * @param {Document} doc - The JSDOM document object
 * @param {string} url - The URL being parsed
 */
function applyParsingRules(doc, url) {
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch (e) {
    hostname = '';
  }

  // 1. Apply global heuristics
  if (globalNoiseSelectors.length > 0) {
    doc.querySelectorAll(globalNoiseSelectors.join(', ')).forEach(el => el.remove());
  }

  // 2. Find and apply domain-specific rules
  const rule = domainRules.find(r => r.match(hostname));
  if (rule) {
    if (rule.selectorsToRemove && rule.selectorsToRemove.length > 0) {
      doc.querySelectorAll(rule.selectorsToRemove.join(', ')).forEach(el => el.remove());
    }
    
    if (typeof rule.preProcess === 'function') {
      rule.preProcess(doc);
    }
  }
}

module.exports = {
  applyParsingRules
};

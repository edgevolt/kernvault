/**
 * Highlighting Utility Functions
 */

// Get all text nodes within a container, ignoring hidden elements or non-text content.
export function getTextNodes(container) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const tag = node.parentNode?.tagName?.toLowerCase();
        if (tag === 'script' || tag === 'style') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    },
    false
  );

  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }
  return textNodes;
}

// Map a DOM selection to a global start and end offset within the container's total text.
export function getSelectionOffsets(container, selection) {
  if (!selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  
  const textNodes = getTextNodes(container);
  
  let start_offset = 0;
  let end_offset = 0;
  let currentOffset = 0;
  let foundStart = false;
  let foundEnd = false;

  for (const node of textNodes) {
    if (!foundStart && node === range.startContainer) {
      start_offset = currentOffset + range.startOffset;
      foundStart = true;
    }
    
    if (!foundEnd && node === range.endContainer) {
      end_offset = currentOffset + range.endOffset;
      foundEnd = true;
    }
    
    currentOffset += node.textContent.length;
    
    if (foundStart && foundEnd) break;
  }
  
  // Handle backwards selection (user dragged right to left)
  if (start_offset > end_offset) {
    const temp = start_offset;
    start_offset = end_offset;
    end_offset = temp;
  }
  
  return { start_offset, end_offset };
}

// Given global start and end offsets, find the text nodes and local offsets to create a DOM Range.
export function getRangeFromOffsets(container, startOffset, endOffset) {
  const textNodes = getTextNodes(container);
  const range = document.createRange();
  
  let currentOffset = 0;
  let startSet = false;
  let endSet = false;

  for (const node of textNodes) {
    const nodeLen = node.textContent.length;
    
    if (!startSet && startOffset >= currentOffset && startOffset <= currentOffset + nodeLen) {
      range.setStart(node, startOffset - currentOffset);
      startSet = true;
    }
    
    if (!endSet && endOffset >= currentOffset && endOffset <= currentOffset + nodeLen) {
      range.setEnd(node, endOffset - currentOffset);
      endSet = true;
    }
    
    currentOffset += nodeLen;
    if (startSet && endSet) break;
  }
  
  // Fallback
  if (!startSet && textNodes.length > 0) range.setStart(textNodes[0], 0);
  if (!endSet && textNodes.length > 0) {
    const lastNode = textNodes[textNodes.length - 1];
    range.setEnd(lastNode, lastNode.textContent.length);
  }
  
  return range;
}

export function renderHighlights(container, highlights, onHighlightClick, onHighlightContextMenu) {
  // Clear existing highlights
  const existingMarks = container.querySelectorAll('mark[data-highlight-id]');
  existingMarks.forEach(mark => {
    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  });

  // Re-normalize container
  container.normalize();

  // Sort highlights so we don't mess up offsets by inserting elements
  const sorted = [...highlights].sort((a, b) => b.start_offset - a.start_offset);

  for (const hl of sorted) {
    try {
      const range = getRangeFromOffsets(container, hl.start_offset, hl.end_offset);
      
      // We need to wrap the range in <mark>. Because range might cross elements,
      // document.execCommand or range.surroundContents might fail.
      // Easiest robust way for highlighting text ranges crossing elements is to wrap text nodes individually.
      
      // Actually, since we're walking backwards, we can safely split text nodes without messing up earlier offsets!
      const startNode = range.startContainer;
      const endNode = range.endContainer;
      
      const nodesToWrap = [];
      const textNodes = getTextNodes(container);
      let collecting = false;
      
      for (const node of textNodes) {
        if (node === startNode) collecting = true;
        if (collecting) nodesToWrap.push(node);
        if (node === endNode) break;
      }
      
      for (const node of nodesToWrap) {
        let textToWrap = node;
        let localStart = node === startNode ? range.startOffset : 0;
        let localEnd = node === endNode ? range.endOffset : node.textContent.length;
        
        if (localStart > 0) {
          textToWrap = node.splitText(localStart);
          localEnd -= localStart;
        }
        if (localEnd < textToWrap.textContent.length) {
          textToWrap.splitText(localEnd);
        }
        
        if (textToWrap.textContent.trim().length > 0) {
          const mark = document.createElement('mark');
          mark.setAttribute('data-highlight-id', hl.id);
          mark.className = hl.annotation_state === 'annotated' ? 'highlight-annotated' : 'highlight-unannotated';
          
          if (onHighlightClick) {
            mark.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              onHighlightClick(hl.id, e);
            };
          }
          if (onHighlightContextMenu) {
            mark.oncontextmenu = (e) => {
              e.preventDefault();
              e.stopPropagation();
              onHighlightContextMenu(hl.id, e);
            };
          }
          
          textToWrap.parentNode.insertBefore(mark, textToWrap);
          mark.appendChild(textToWrap);
        }
      }
    } catch (e) {
      console.warn('Failed to render highlight', hl.id, e);
    }
  }
}

// Sentence splitting for mobile
export function splitSentences(text) {
  const regex = /([^.!?]+[.!?]+(?:\s|$))/g;
  let match;
  const sentences = [];
  let currentIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const str = match[0];
    sentences.push({
      text: str,
      startOffset: currentIndex,
      endOffset: currentIndex + str.length
    });
    currentIndex += str.length;
  }
  
  if (currentIndex < text.length) {
    sentences.push({
      text: text.slice(currentIndex),
      startOffset: currentIndex,
      endOffset: text.length
    });
  }
  return sentences;
}

// Wraps text nodes matching sentence boundaries into `<span data-sentence-index="N">`
export function wrapSentencesInDOM(container, sentences) {
  if (container.querySelector('[data-sentence-index]')) return;

  const textNodes = getTextNodes(container);
  let globalOffset = 0;
  let currentSentenceIndex = 0;

  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    const nodeText = node.textContent;
    const nodeStart = globalOffset;
    const nodeEnd = globalOffset + nodeText.length;
    
    let currentSentence = sentences[currentSentenceIndex];
    if (!currentSentence) break;

    if (nodeStart < currentSentence.endOffset && nodeEnd > currentSentence.startOffset) {
      let isAnchor = false;
      let parent = node.parentNode;
      while (parent && parent !== container) {
        if (parent.tagName && parent.tagName.toLowerCase() === 'a') {
          isAnchor = true;
          break;
        }
        parent = parent.parentNode;
      }

      if (!isAnchor) {
        const localStart = Math.max(0, currentSentence.startOffset - nodeStart);
        const localEnd = Math.min(nodeText.length, currentSentence.endOffset - nodeStart);
        
        if (localStart > 0 || localEnd < nodeText.length) {
          if (localStart > 0) {
            const splitPoint = node.splitText(localStart);
            textNodes.splice(i + 1, 0, splitPoint);
            globalOffset += localStart;
            continue; 
          }
          if (localEnd < node.textContent.length) {
            const splitPoint = node.splitText(localEnd);
            textNodes.splice(i + 1, 0, splitPoint);
          }
        }
      }

      if (node.textContent.trim().length > 0) {
        const span = document.createElement('span');
        span.setAttribute('data-sentence-index', currentSentenceIndex);
        span.className = 'transition-colors duration-150 rounded cursor-pointer';
        node.parentNode.insertBefore(span, node);
        span.appendChild(node);
      }

      if (nodeEnd >= currentSentence.endOffset) {
        currentSentenceIndex++;
      }
    }
    globalOffset += node.textContent.length;
  }
}

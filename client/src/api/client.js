const BASE = '/api';

async function request(method, path, body) {
  const opts = { method, headers: {} };
  
  if (body !== undefined) {
    if (body instanceof FormData) {
      opts.body = body;
      // browser automatically sets Content-Type with boundary for FormData
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${BASE}${path}`, opts);

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Spaces
  getSpaces:       ()       => request('GET',    '/spaces'),
  getSpace:        (id)     => request('GET',    `/spaces/${id}`),
  getSpaceTrail:   (id)     => request('GET',    `/spaces/${id}/trail`),
  createSpace:     (body)   => request('POST',   '/spaces', body),
  updateSpace:     (id, b)  => request('PATCH',  `/spaces/${id}`, b),
  deleteSpace:     (id)     => request('DELETE', `/spaces/${id}`),

  // Stages
  createStage:     (spaceId, body) => request('POST',   `/spaces/${spaceId}/stages`, body),
  updateStage:     (id, body)      => request('PATCH',  `/spaces/stages/${id}`, body),
  deleteStage:     (id)            => request('DELETE', `/spaces/stages/${id}`),
  reorderStages:   (body)          => request('POST',   '/spaces/stages/reorder', body),

  // Items
  getItems:        (stageId)       => request('GET',    `/stages/${stageId}/items`),
  createItem:      (stageId, body) => request('POST',   `/stages/${stageId}/items`, body),
  getItem:         (id)            => request('GET',    `/items/${id}`),
  updateItem:      (id, body)      => request('PATCH',  `/items/${id}`, body),
  deleteItem:      (id)            => request('DELETE', `/items/${id}`),
  reorderItems:    (body)          => request('POST',   '/items/reorder', body),

  // Notes
  getNotes:         (itemId)       => request('GET',    `/items/${itemId}/notes`),
  createNote:       (itemId, body) => request('POST',   `/items/${itemId}/notes`, body),
  deleteNote:       (id)           => request('DELETE', `/notes/${id}`),

  // Highlights
  getItemHighlights: (itemId)      => request('GET',    `/items/${itemId}/highlights`),
  createHighlight:   (body)        => request('POST',   `/highlights`, body),
  updateHighlight:   (id, body)    => request('PATCH',  `/highlights/${id}`, body),
  deleteHighlight:   (id)          => request('DELETE', `/highlights/${id}`),

  // Pause points
  getPausePoints:   (itemId)       => request('GET',    `/items/${itemId}/pause-points`),
  createPausePoint: (itemId, body) => request('POST',   `/items/${itemId}/pause-points`, body),
  updatePausePoint: (id, body)     => request('PATCH',  `/pause-points/${id}`, body),

  // Recall
  getRecallQueue:       (itemId) => request('GET', itemId ? `/recall?item_id=${itemId}` : '/recall'),
  submitRecallSession:  (id, body) => request('POST', `/items/${id}/recall`, body),

  // Learning Map
  getLearningMap:       (spaceId)       => request('GET',    `/spaces/${spaceId}/map`),
  linkQuestion:         (id, body)      => request('PATCH',  `/questions/${id}`, body),
  createItemConnection: (body)          => request('POST',   '/item-connections', body),
  updateItemConnection: (id, body)      => request('PATCH',  `/item-connections/${id}`, body),
  deleteItemConnection: (id)            => request('DELETE', `/item-connections/${id}`),

  // Search
  search: (q) => request('GET', `/search?q=${encodeURIComponent(q)}`),

  // Templates
  getTemplates:    ()      => request('GET',    '/templates'),
  createTemplate:  (body)  => request('POST',   '/templates', body),
  deleteTemplate:  (id)    => request('DELETE', `/templates/${id}`),

  // Settings / data
  getDigest:     () => request('GET', '/digest'),
  exportData:    () => fetch(`${BASE}/export`).then(r => r.blob()),
  deleteAllData: async () => {
    const { token } = await request('GET', '/admin-token');
    return request('DELETE', '/data', { confirm: 'DELETE_ALL', token });
  },

  // Synthesis
  getSynthesisData:          (spaceId) => request('GET',    `/spaces/${spaceId}/synthesis`),
  createSynthesisNode:       (body)    => request('POST',   '/synthesis/nodes', body),
  updateSynthesisNode:       (id, b)   => request('PATCH',  `/synthesis/nodes/${id}`, b),
  deleteSynthesisNode:       (id)      => request('DELETE', `/synthesis/nodes/${id}`),
  createSynthesisConnection: (body)    => request('POST',   '/synthesis/connections', body),
  updateSynthesisConnection: (id, b)   => request('PATCH',  `/synthesis/connections/${id}`, b),
  deleteSynthesisConnection: (id)      => request('DELETE', `/synthesis/connections/${id}`),
};

const MAX_SELECTION = 5000;

function asSet(value) {
  const values = value instanceof Set ? [...value] : Array.isArray(value) ? value : [];
  return new Set(values.filter(id => typeof id === "string" && id.trim()).slice(0, MAX_SELECTION));
}

function cleanIds(value) {
  const values = Array.isArray(value) ? value : [];
  return [...new Set(values.filter(id => typeof id === "string" && id.trim()))].slice(0, MAX_SELECTION);
}

export function toggleSelection(selection, id, checked) {
  const next = asSet(selection);
  if (typeof id !== "string" || !id.trim()) return next;
  if (checked) {
    if (next.size < MAX_SELECTION || next.has(id)) next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}

export function toggleVisibleSelection(selection, visibleIds) {
  const next = asSet(selection);
  const ids = cleanIds(visibleIds);
  if (!ids.length) return next;
  if (ids.every(id => next.has(id))) {
    ids.forEach(id => next.delete(id));
  } else {
    ids.forEach(id => {
      if (next.size < MAX_SELECTION || next.has(id)) next.add(id);
    });
  }
  return next;
}

export function selectedInOrder(selection, orderedIds) {
  const selected = asSet(selection);
  return cleanIds(orderedIds).filter(id => selected.has(id));
}

export function pruneSelection(selection, availableIds) {
  const available = new Set(cleanIds(availableIds));
  return new Set([...asSet(selection)].filter(id => available.has(id)));
}

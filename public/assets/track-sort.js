export const TRACK_SORT_MODES = Object.freeze({
  "added-desc": "Сначала новые", "title-asc": "По названию", "artist-asc": "По исполнителю", "duration-desc": "По длительности"
});
const collator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });
export function sortTracks(tracks, mode = "added-desc") {
  const source = Array.isArray(tracks) ? tracks : [];
  const selected = Object.hasOwn(TRACK_SORT_MODES, mode) ? mode : "added-desc";
  return source.map((track, index) => ({ track, index })).sort((a, b) => {
    let result = 0;
    if (selected === "title-asc") result = collator.compare(String(a.track?.title || ""), String(b.track?.title || ""));
    else if (selected === "artist-asc") result = collator.compare(String(a.track?.artist || ""), String(b.track?.artist || ""));
    else if (selected === "duration-desc") result = (Number(b.track?.duration) || 0) - (Number(a.track?.duration) || 0);
    else result = (Number(b.track?.addedAt || b.track?.lastModified) || 0) - (Number(a.track?.addedAt || a.track?.lastModified) || 0);
    return result || a.index - b.index;
  }).map(entry => entry.track);
}

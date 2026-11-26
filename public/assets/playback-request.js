/**
 * Invalidates asynchronous playback work when a newer track is requested
 * or playback is explicitly stopped.
 */
export class PlaybackRequestGate {
  constructor() {
    this.sequence = 0;
  }

  begin() {
    this.sequence = this.sequence >= Number.MAX_SAFE_INTEGER ? 1 : this.sequence + 1;
    return this.sequence;
  }

  invalidate() {
    return this.begin();
  }

  isCurrent(token) {
    return Number.isSafeInteger(token) && token === this.sequence;
  }
}

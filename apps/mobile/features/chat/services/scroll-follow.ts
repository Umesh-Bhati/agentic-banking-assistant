/** Native layout/programmatic scroll events must not look like a user scrolling up. */
export class ScrollFollow {
  following = true;
  interacting = false;
  startRun() { this.following = true; }
  beginGesture() { this.interacting = true; this.following = false; }
  endGesture() { this.interacting = false; }
  updatePosition(contentHeight: number, viewportHeight: number, offsetY: number) {
    if (this.interacting) this.following = contentHeight - viewportHeight - Math.max(0, offsetY) <= 64;
  }
  get shouldFollow() { return this.following && !this.interacting; }
}

import { describe, expect, it } from 'vitest';
import { ScrollFollow } from './scroll-follow';

describe('stream scroll following', () => {
  it('keeps following through content growth and keyboard resize echoes', () => {
    const state = new ScrollFollow();
    state.updatePosition(1500, 700, 800);
    state.updatePosition(1800, 400, 800);
    expect(state.shouldFollow).toBe(true);
  });
  it('pauses immediately when the user starts scrolling and preserves older content', () => {
    const state = new ScrollFollow();
    state.beginGesture();
    expect(state.shouldFollow).toBe(false);
    state.updatePosition(1800, 400, 500);
    state.endGesture();
    state.updatePosition(2200, 400, 500);
    expect(state.shouldFollow).toBe(false);
  });
  it('resumes when the user returns to the bottom or sends a new message', () => {
    const state = new ScrollFollow();
    state.beginGesture();
    state.updatePosition(1800, 400, 1400);
    state.endGesture();
    expect(state.shouldFollow).toBe(true);
    state.beginGesture(); state.updatePosition(1800, 400, 100); state.endGesture();
    state.startRun();
    expect(state.shouldFollow).toBe(true);
  });
});

import { useCallback, useEffect, useRef } from 'react';
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useAuiState, type ThreadMessage } from '@assistant-ui/react-native';
import { ScrollFollow } from '../services/scroll-follow';

export function useChatScroll() {
  const listRef = useRef<FlatList<ThreadMessage>>(null);
  const follow = useRef(new ScrollFollow());
  const frame = useRef<number | null>(null);
  const isRunning = useAuiState(s => s.thread.isRunning);
  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const followLatest = useCallback(() => {
    if (!follow.current.shouldFollow || frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (follow.current.shouldFollow) listRef.current?.scrollToEnd({ animated: false });
    });
  }, []);
  useEffect(() => {
    if (isRunning) { follow.current.startRun(); followLatest(); }
  }, [isRunning, followLatest]);
  useEffect(() => cancel, [cancel]);
  const beginGesture = useCallback(() => { cancel(); follow.current.beginGesture(); }, [cancel]);
  const onScroll = useCallback(({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    follow.current.updatePosition(nativeEvent.contentSize.height, nativeEvent.layoutMeasurement.height, nativeEvent.contentOffset.y);
  }, []);
  const endGesture = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScroll(event); follow.current.endGesture(); followLatest();
  }, [onScroll, followLatest]);
  return { ref: listRef, onContentSizeChange: followLatest, onLayout: followLatest, onScroll,
    onScrollBeginDrag: beginGesture, onScrollEndDrag: endGesture,
    onMomentumScrollBegin: beginGesture, onMomentumScrollEnd: endGesture };
}

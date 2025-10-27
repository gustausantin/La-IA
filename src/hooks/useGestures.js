// useGestures.js - Hook para manejar gestos táctiles
import { useState, useRef, useCallback } from 'react';
import { DESIGN_TOKENS } from '../styles/tokens';

export const useSwipe = ({ 
  onSwipeLeft, 
  onSwipeRight, 
  onSwipeUp, 
  onSwipeDown,
  threshold = DESIGN_TOKENS.gestures.swipeThreshold 
} = {}) => {
  const touchStart = useRef({ x: 0, y: 0 });
  const touchEnd = useRef({ x: 0, y: 0 });

  const onTouchStart = useCallback((e) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const onTouchMove = useCallback((e) => {
    touchEnd.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const onTouchEnd = useCallback(() => {
    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaY = touchEnd.current.y - touchStart.current.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Horizontal swipe
    if (absDeltaX > absDeltaY && absDeltaX > threshold) {
      if (deltaX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    }
    
    // Vertical swipe
    if (absDeltaY > absDeltaX && absDeltaY > threshold) {
      if (deltaY > 0) {
        onSwipeDown?.();
      } else {
        onSwipeUp?.();
      }
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
};

export const useLongPress = ({ 
  onLongPress, 
  delay = DESIGN_TOKENS.gestures.longPressDelay 
} = {}) => {
  const timerRef = useRef(null);
  const isLongPress = useRef(false);

  const start = useCallback((e) => {
    isLongPress.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress?.(e);
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onClick = useCallback((e) => {
    // Prevent click if it was a long press
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    onClick,
  };
};

export const useDoubleTap = ({ 
  onDoubleTap, 
  delay = DESIGN_TOKENS.gestures.doubleTapDelay 
} = {}) => {
  const lastTap = useRef(0);

  const onTap = useCallback((e) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTap.current;

    if (timeSinceLastTap < delay && timeSinceLastTap > 0) {
      onDoubleTap?.(e);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }, [onDoubleTap, delay]);

  return {
    onClick: onTap,
  };
};

export const usePullToRefresh = ({ 
  onRefresh,
  threshold = DESIGN_TOKENS.gestures.pullToRefreshThreshold 
} = {}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const scrollTop = useRef(0);

  const onTouchStart = useCallback((e) => {
    scrollTop.current = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop.current === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (scrollTop.current === 0 && startY.current > 0) {
      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;
      
      if (distance > 0) {
        setPullDistance(distance);
        setIsPulling(distance > threshold);
      }
    }
  }, [threshold]);

  const onTouchEnd = useCallback(async () => {
    if (isPulling) {
      setIsPulling(false);
      await onRefresh?.();
    }
    setPullDistance(0);
    startY.current = 0;
  }, [isPulling, onRefresh]);

  return {
    isPulling,
    pullDistance,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
};

// Hook combinado para todos los gestos
export const useGestures = (handlers = {}) => {
  const swipe = useSwipe(handlers);
  const longPress = useLongPress(handlers);
  const doubleTap = useDoubleTap(handlers);
  const pullToRefresh = usePullToRefresh(handlers);

  return {
    swipe,
    longPress,
    doubleTap,
    pullToRefresh,
  };
};

export default useGestures;


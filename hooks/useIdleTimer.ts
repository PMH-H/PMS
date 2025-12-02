
import { useState, useEffect, useRef } from 'react';

/**
 * A custom hook to detect when a user is idle.
 * @param onIdle - The function to call when the user is determined to be idle.
 * @param idleTime - The amount of time in milliseconds to wait before considering the user idle.
 */
export const useIdleTimer = (onIdle: () => void, idleTime: number) => {
  const timeoutId = useRef<number | null>(null);

  const resetTimer = () => {
    if (timeoutId.current) {
      window.clearTimeout(timeoutId.current);
    }
    timeoutId.current = window.setTimeout(onIdle, idleTime);
  };

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];

    const handleActivity = () => {
      resetTimer();
    };

    // Set up event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Initialize the timer
    resetTimer();

    // Cleanup
    return () => {
      if (timeoutId.current) {
        window.clearTimeout(timeoutId.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [onIdle, idleTime]);

  return {}; // This hook doesn't need to return anything
};

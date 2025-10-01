import { useEffect, useCallback, useRef, useState } from 'react';

/**
 * Hook to make components clearable when PHI needs to be removed
 * (e.g., on logout or session timeout)
 */
export function usePHIClearable(clearCallback: () => void, dependencies: any[] = []) {
  const callbackRef = useRef(clearCallback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = clearCallback;
  }, [clearCallback, ...dependencies]);

  const handleClearPHI = useCallback(() => {
    callbackRef.current();
  }, []);

  useEffect(() => {
    // Listen for clear-phi events
    window.addEventListener('clear-phi', handleClearPHI);

    return () => {
      window.removeEventListener('clear-phi', handleClearPHI);
    };
  }, [handleClearPHI]);
}

/**
 * Mark an element as containing PHI for automatic clearing
 */
export function markAsPHI(element: HTMLElement | null) {
  if (element) {
    element.setAttribute('data-phi', 'true');
  }
}

/**
 * Hook to automatically clear a component's state on PHI clear event
 */
export function useClearablePHIState<T>(
  initialValue: T,
  clearValue: T = initialValue
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [state, setState] = useState<T>(initialValue);

  const clear = useCallback(() => {
    setState(clearValue);
  }, [clearValue]);

  usePHIClearable(clear);

  return [state, setState, clear];
}

// For class components or imperative clearing
export function clearAllPHI() {
  window.dispatchEvent(new CustomEvent('clear-phi'));
}

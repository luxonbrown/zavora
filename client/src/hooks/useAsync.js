import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal async-data hook. Gives every page the same
 * loading / error / empty contract without a data library.
 *
 * `deps` behaves like a useEffect dependency list. `initial` is the value
 * returned while the first load is in flight.
 */
export default function useAsync(fn, deps = [], { initial = null, immediate = true } = {}) {
  const [state, setState] = useState({ data: initial, loading: immediate, error: null });
  const mounted = useRef(true);
  const runId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    const id = ++runId.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fn();
      // Ignore results from superseded requests.
      if (!mounted.current || id !== runId.current) return;
      setState({ data, loading: false, error: null });
    } catch (error) {
      if (!mounted.current || id !== runId.current) return;
      setState({ data: initial, loading: false, error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) run();
     
  }, [run, immediate]);

  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}

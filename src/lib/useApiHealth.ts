'use client';
import { useEffect, useState } from 'react';
import { request } from './api';
import { endpoints } from './endpoints';

export function useApiHealth() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        await request(endpoints.openapi);
        on && setOk(true);
      } catch {
        on && setOk(false);
      }
    })();
    return () => {
      on = false;
    };
  }, []);
  return ok;
}

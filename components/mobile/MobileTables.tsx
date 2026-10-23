'use client';

import { useEffect } from 'react';
import { installMobileTables } from '@/lib/mobileTables';

/** Phones: turns wide tables into cards (see lib/mobileTables.ts). Renders nothing. */
export default function MobileTables() {
  useEffect(() => installMobileTables(), []);
  return null;
}

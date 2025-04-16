'use client';

import React from 'react';
import { Toaster } from 'sonner';
import { Web3Provider } from './context/Web3Context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Web3Provider>
      {children}
      <Toaster position="top-right" />
    </Web3Provider>
  );
} 
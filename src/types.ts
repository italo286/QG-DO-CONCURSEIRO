import React from 'react';

// Re-export all server-safe types
export * from './types.server';

// Define client-only types that depend on React
export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: React.FC<{className?: string}>;
}

// Define global window types for the frontend
declare global {
  interface Window {
    customGoBack?: () => boolean; 
    androidGoBack?: () => boolean;
    Android?: {
      downloadPdf: (base64Data: string, fileName: string) => void;
    };
  }
}
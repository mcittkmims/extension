import type { OverlayElements, OverlayState, Position } from "../types";

export interface EventBindingsOptions {
  elements: OverlayElements;
  state: OverlayState;
  posKey: string;
  chat: {
    toggle: () => void;
    close: () => void;
    send: () => Promise<void>;
    reset: () => Promise<void>;
    runQuizScreenshot: () => Promise<void>;
    runQuizAutofill: () => Promise<void>;
  };
  settings: {
    toggle: () => void;
    autoSave: () => Promise<void>;
    updateProviderModels: (
      provider: string,
      model: string | null,
      settings?: object
    ) => Promise<void>;
  };
  layout: {
    normalizeViewportState: (options?: {
      left?: number;
      top?: number;
      persist?: boolean;
    }) => void;
    getViewportBounds: () => Position & { width: number; height: number };
    getChatSizeLimits: () => {
      minWidth: number;
      maxWidth: number;
      minHeight: number;
      maxHeight: number;
    };
  };
  theme: {
    updateDarkMode: () => void;
  };
  images: {
    handleFile: (file: File) => void;
    remove: () => void;
    openPicker: () => void;
  };
}

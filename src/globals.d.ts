interface KatexGlobal {
  render: (
    expression: string,
    element: Element,
    options: { displayMode: boolean; throwOnError: boolean }
  ) => void;
}

declare global {
  interface Window {
    katex?: KatexGlobal;
  }

  interface MarkedLike {
    parse: (markdown: string, options?: object) => string;
  }

  var marked: MarkedLike | undefined;
}

export {};

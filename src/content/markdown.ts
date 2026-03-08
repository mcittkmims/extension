import katex from "katex";
import { marked } from "marked";

const ALLOWED_MARKDOWN_TAGS = new Set([
  "A",
  "BLOCKQUOTE",
  "BR",
  "CODE",
  "DEL",
  "EM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "LI",
  "OL",
  "P",
  "PRE",
  "SPAN",
  "STRONG",
  "TABLE",
  "TBODY",
  "TD",
  "TH",
  "THEAD",
  "TR",
  "UL"
]);

const MARKED_OPTIONS = {
  breaks: true,
  gfm: true
};

const MATH_TOKEN_PREFIX = "MATH_TOKEN_";

interface ExtractedMath {
  latex: string;
  display: boolean;
}

let katexReady: Promise<void> | null = null;

export function loadKaTeX(): Promise<void> {
  if (!katexReady) {
    katexReady = Promise.resolve();
  }
  return katexReady;
}

export function renderMath(element: HTMLElement): void {
  void loadKaTeX().then(() => {
    element
      .querySelectorAll<HTMLElement>(".ai-math-display")
      .forEach((span) => {
        try {
          katex.render(span.dataset.latex || "", span, {
            displayMode: true,
            throwOnError: false
          });
        } catch {
          span.textContent = span.dataset.latex || "";
        }
      });

    element.querySelectorAll<HTMLElement>(".ai-math-inline").forEach((span) => {
      try {
        katex.render(span.dataset.latex || "", span, {
          displayMode: false,
          throwOnError: false
        });
      } catch {
        span.textContent = span.dataset.latex || "";
      }
    });
  });
}

function sanitizeMarkdownNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent || "");
  }

  if (!(node instanceof Element)) {
    return null;
  }

  if (!ALLOWED_MARKDOWN_TAGS.has(node.tagName)) {
    const fragment = doc.createDocumentFragment();
    Array.from(node.childNodes).forEach((child) => {
      const sanitizedChild = sanitizeMarkdownNode(child, doc);
      if (sanitizedChild) {
        fragment.appendChild(sanitizedChild);
      }
    });
    return fragment;
  }

  const element = doc.createElement(node.tagName.toLowerCase());

  if (node.tagName === "A") {
    const href = node.getAttribute("href") || "";
    if (/^(https?:|mailto:)/i.test(href)) {
      element.setAttribute("href", href);
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
  } else if (node.tagName === "SPAN") {
    const className = node.getAttribute("class") || "";
    if (className === "ai-math-display" || className === "ai-math-inline") {
      element.setAttribute("class", className);
      const latex = node.getAttribute("data-latex");
      if (latex) {
        element.setAttribute("data-latex", latex);
      }
    }
  } else if (node.tagName === "CODE") {
    const className = node.getAttribute("class") || "";
    if (/^language-[a-z0-9_-]+$/i.test(className)) {
      element.setAttribute("class", className);
    }
  } else if (node.tagName === "TH" || node.tagName === "TD") {
    const align = node.getAttribute("align");
    if (align && /^(left|center|right)$/i.test(align)) {
      element.setAttribute("align", align.toLowerCase());
    }
  }

  Array.from(node.childNodes).forEach((child) => {
    const sanitizedChild = sanitizeMarkdownNode(child, doc);
    if (sanitizedChild) {
      element.appendChild(sanitizedChild);
    }
  });

  return element;
}

function sanitizeMarkdownHtml(html: string): DocumentFragment {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  const fragment = document.createDocumentFragment();

  Array.from(parsed.body.childNodes).forEach((node) => {
    const sanitizedNode = sanitizeMarkdownNode(node, document);
    if (sanitizedNode) {
      fragment.appendChild(sanitizedNode);
    }
  });

  return fragment;
}

function extractMath(text: string): {
  text: string;
  mathStore: ExtractedMath[];
} {
  const mathStore: ExtractedMath[] = [];
  const stash = (latex: string, display: boolean): string => {
    const idx = mathStore.length;
    mathStore.push({ latex: latex.trim(), display });
    return `${MATH_TOKEN_PREFIX}${idx}__`;
  };

  return {
    text: text
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, latex: string) => stash(latex, true))
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, latex: string) => stash(latex, false))
      .replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$/g, (_, latex: string) =>
        stash(latex, false)
      )
      .replace(/\$\$([\s\S]*?)\$\$/g, (_, latex: string) => stash(latex, true)),
    mathStore
  };
}

function renderMarkdown(text: string): string {
  return marked.parse(text, MARKED_OPTIONS) as string;
}

function restoreMath(html: string, mathStore: ExtractedMath[]): string {
  return html.replace(
    new RegExp(`${MATH_TOKEN_PREFIX}(\\d+)__`, "g"),
    (_, index: string) => {
      const entry = mathStore[Number(index)];
      const className = entry.display ? "ai-math-display" : "ai-math-inline";
      const escapedLatex = entry.latex.replace(/"/g, "&quot;");
      return `<span class="${className}" data-latex="${escapedLatex}"></span>`;
    }
  );
}

export function parseMarkdown(text: string): DocumentFragment {
  const parsed = extractMath(text);
  const html = renderMarkdown(parsed.text);
  return sanitizeMarkdownHtml(restoreMath(html, parsed.mathStore));
}

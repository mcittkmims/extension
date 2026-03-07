// @ts-nocheck

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
  gfm: true,
  breaks: true,
  headerIds: false,
  mangle: false
};

const MARKED_API =
  globalThis.marked && typeof globalThis.marked.parse === "function"
    ? globalThis.marked
    : null;

let katexReady = null;

export function loadKaTeX() {
  if (!katexReady) katexReady = Promise.resolve();
  return katexReady;
}

export function renderMath(el) {
  loadKaTeX().then(() => {
    if (!window.katex) return;
    el.querySelectorAll(".ai-math-display").forEach((span) => {
      try {
        katex.render(span.dataset.latex, span, {
          displayMode: true,
          throwOnError: false
        });
      } catch {
        span.textContent = span.dataset.latex;
      }
    });
    el.querySelectorAll(".ai-math-inline").forEach((span) => {
      try {
        katex.render(span.dataset.latex, span, {
          displayMode: false,
          throwOnError: false
        });
      } catch {
        span.textContent = span.dataset.latex;
      }
    });
  });
}

function sanitizeMarkdownNode(node, doc) {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  if (!ALLOWED_MARKDOWN_TAGS.has(node.tagName)) {
    const fragment = doc.createDocumentFragment();
    Array.from(node.childNodes).forEach((child) => {
      const sanitizedChild = sanitizeMarkdownNode(child, doc);
      if (sanitizedChild) fragment.appendChild(sanitizedChild);
    });
    return fragment;
  }

  const el = doc.createElement(node.tagName.toLowerCase());

  if (node.tagName === "A") {
    const href = node.getAttribute("href") || "";
    if (/^(https?:|mailto:)/i.test(href)) {
      el.setAttribute("href", href);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  } else if (node.tagName === "SPAN") {
    const cls = node.getAttribute("class") || "";
    if (cls === "ai-math-display" || cls === "ai-math-inline") {
      el.setAttribute("class", cls);
      const latex = node.getAttribute("data-latex");
      if (latex != null) el.setAttribute("data-latex", latex);
    }
  } else if (node.tagName === "CODE") {
    const cls = node.getAttribute("class") || "";
    if (/^language-[a-z0-9_-]+$/i.test(cls)) {
      el.setAttribute("class", cls);
    }
  } else if (node.tagName === "TH" || node.tagName === "TD") {
    const align = node.getAttribute("align");
    if (align && /^(left|center|right)$/i.test(align)) {
      el.setAttribute("align", align.toLowerCase());
    }
  }

  Array.from(node.childNodes).forEach((child) => {
    const sanitizedChild = sanitizeMarkdownNode(child, doc);
    if (sanitizedChild) el.appendChild(sanitizedChild);
  });

  return el;
}

function sanitizeMarkdownHtml(html) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  const fragment = document.createDocumentFragment();

  Array.from(parsed.body.childNodes).forEach((node) => {
    const sanitizedNode = sanitizeMarkdownNode(node, document);
    if (sanitizedNode) fragment.appendChild(sanitizedNode);
  });

  return fragment;
}

function extractMath(text) {
  const mathStore = [];
  const stash = (latex, display) => {
    const idx = mathStore.length;
    mathStore.push({ latex: latex.trim(), display });
    return `\x00MATH${idx}\x00`;
  };

  return {
    text: text
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => stash(latex, true))
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => stash(latex, false))
      .replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$/g, (_, latex) =>
        stash(latex, false)
      )
      .replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => stash(latex, true)),
    mathStore
  };
}

function renderMarkdown(text) {
  return MARKED_API ? MARKED_API.parse(text, MARKED_OPTIONS) : `<p>${text}</p>`;
}

function restoreMath(html, mathStore) {
  return html.replace(/\x00MATH(\d+)\x00/g, (_, i) => {
    const { latex, display } = mathStore[+i];
    const cls = display ? "ai-math-display" : "ai-math-inline";
    const escaped = latex.replace(/"/g, "&quot;");
    return `<span class="${cls}" data-latex="${escaped}"></span>`;
  });
}

export function parseMarkdown(text) {
  const parsed = extractMath(text);
  const html = renderMarkdown(parsed.text);
  return sanitizeMarkdownHtml(restoreMath(html, parsed.mathStore));
}

import type {
  LayoutResult,
  OverlayElements,
  OverlayState,
  Position,
  Size,
  SizeLimits,
  ViewportBounds
} from "./types";

export interface LayoutController {
  loadBtnPos: (cb: (position: Position) => void) => void;
  saveBtnPos: (left: number, top: number) => void;
  getViewportBounds: () => ViewportBounds;
  getCurrentButtonPos: () => Position;
  getCurrentChatSize: () => Size;
  getChatSizeLimits: () => SizeLimits;
  positionChatbox: (left: number, top: number) => LayoutResult;
  applyPos: (left: number, top: number) => Position;
  applyChatSize: (width: number, height: number) => Size;
  normalizeViewportState: (options?: {
    left?: number;
    top?: number;
    persist?: boolean;
  }) => Position & Size & { positionChanged: boolean; sizeChanged: boolean };
}

interface LayoutOptions {
  posKey: string;
  elements: OverlayElements;
  state: OverlayState;
  onResizeCornerChange: (layout: LayoutResult) => void;
  onAutoSave: () => void;
}

export function createLayoutController({
  posKey,
  elements,
  state,
  onResizeCornerChange,
  onAutoSave
}: LayoutOptions): LayoutController {
  const { aiButton, chatbox } = elements;

  function clampValue(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function loadBtnPos(cb: (position: Position) => void): void {
    browser.storage.local.get(posKey).then((result) => {
      cb((result[posKey] as Position | undefined) ?? getDefaultButtonPos());
    });
  }

  function saveBtnPos(left: number, top: number): void {
    void browser.storage.local.set({ [posKey]: { left, top } });
  }

  function getViewportBounds(): ViewportBounds {
    const vv = window.visualViewport;
    return {
      left: Math.round(vv?.offsetLeft ?? 0),
      top: Math.round(vv?.offsetTop ?? 0),
      width: Math.round(vv?.width ?? window.innerWidth),
      height: Math.round(vv?.height ?? window.innerHeight)
    };
  }

  function getDefaultButtonPos(): Position {
    const viewport = getViewportBounds();
    return {
      left: viewport.left + viewport.width - 38,
      top: viewport.top + viewport.height - 38
    };
  }

  function clampButtonToViewport(left: number, top: number): Position {
    const viewport = getViewportBounds();
    const bw = aiButton.offsetWidth || 20;
    const bh = aiButton.offsetHeight || 20;
    return {
      left: clampValue(
        left,
        viewport.left + 4,
        viewport.left + viewport.width - bw - 4
      ),
      top: clampValue(
        top,
        viewport.top + 4,
        viewport.top + viewport.height - bh - 4
      )
    };
  }

  function getCurrentButtonPos(): Position {
    const fallback = getDefaultButtonPos();
    return {
      left:
        parseFloat(aiButton.style.left) || aiButton.offsetLeft || fallback.left,
      top: parseFloat(aiButton.style.top) || aiButton.offsetTop || fallback.top
    };
  }

  function getCurrentChatSize(): Size {
    return {
      width: parseFloat(chatbox.style.width) || chatbox.offsetWidth || 320,
      height: parseFloat(chatbox.style.height) || chatbox.offsetHeight || 480
    };
  }

  function getChatSizeLimits(): SizeLimits {
    const viewport = getViewportBounds();
    const availableWidth = Math.max(1, viewport.width - 8);
    const availableHeight = Math.max(1, viewport.height - 8);
    const minWidth = Math.min(220, availableWidth);
    const minHeight = Math.min(state.settingsMinHeight, availableHeight);
    return {
      minWidth,
      maxWidth: Math.max(minWidth, Math.min(700, availableWidth)),
      minHeight,
      maxHeight: Math.max(minHeight, Math.min(700, availableHeight))
    };
  }

  function computeLayout(left: number, top: number): LayoutResult {
    const viewportBounds = getViewportBounds();
    const boxW = chatbox.offsetWidth || 320;
    const boxH = chatbox.offsetHeight || 480;
    const bw = aiButton.offsetWidth || 20;
    const bh = aiButton.offsetHeight || 20;
    const gap = 6;
    const margin = 4;
    const viewport = clampButtonToViewport(left, top);

    if (!state.isOpen) {
      const closedTop = clampValue(
        viewport.top + bh + gap,
        viewportBounds.top + margin,
        viewportBounds.top + viewportBounds.height - boxH - margin
      );
      const btnCenterX = viewport.left + bw / 2;
      const isButtonLeft =
        btnCenterX < viewportBounds.left + viewportBounds.width / 2;
      const closedLeft = isButtonLeft
        ? clampValue(
            viewport.left,
            viewportBounds.left + margin,
            viewportBounds.left + viewportBounds.width - boxW - margin
          )
        : clampValue(
            viewport.left + bw - boxW,
            viewportBounds.left + margin,
            viewportBounds.left + viewportBounds.width - boxW - margin
          );

      return {
        left: viewport.left,
        top: viewport.top,
        buttonLeft: viewport.left,
        buttonTop: viewport.top,
        chatLeft: closedLeft,
        chatTop: closedTop,
        isAbove: false,
        isButtonLeft
      };
    }

    let finalLeft = viewport.left;
    let finalTop = viewport.top;
    const isAbove = viewport.top - boxH - gap >= viewportBounds.top + margin;
    const minTop = isAbove
      ? Math.max(
          viewportBounds.top + margin,
          viewportBounds.top + boxH + gap + margin
        )
      : viewportBounds.top + margin;
    const maxTop = isAbove
      ? viewportBounds.top + viewportBounds.height - bh - margin
      : Math.min(
          viewportBounds.top + viewportBounds.height - bh - margin,
          viewportBounds.top + viewportBounds.height - boxH - bh - gap - margin
        );

    if (minTop <= maxTop) {
      finalTop = clampValue(finalTop, minTop, maxTop);
    }

    const btnCenterX = viewport.left + bw / 2;
    const isButtonLeft =
      btnCenterX < viewportBounds.left + viewportBounds.width / 2;
    const minLeft = isButtonLeft
      ? viewportBounds.left + margin
      : Math.max(
          viewportBounds.left + margin,
          viewportBounds.left + boxW - bw + margin
        );
    const maxLeft = isButtonLeft
      ? Math.min(
          viewportBounds.left + viewportBounds.width - bw - margin,
          viewportBounds.left + viewportBounds.width - boxW - margin
        )
      : viewportBounds.left + viewportBounds.width - bw - margin;

    if (minLeft <= maxLeft) {
      finalLeft = clampValue(finalLeft, minLeft, maxLeft);
    }

    let chatTop = isAbove ? finalTop - boxH - gap : finalTop + bh + gap;
    chatTop = clampValue(
      chatTop,
      viewportBounds.top + margin,
      viewportBounds.top + viewportBounds.height - boxH - margin
    );

    let chatLeft = isButtonLeft ? finalLeft : finalLeft + bw - boxW;
    chatLeft = clampValue(
      chatLeft,
      viewportBounds.left + margin,
      viewportBounds.left + viewportBounds.width - boxW - margin
    );

    return {
      left: finalLeft,
      top: finalTop,
      buttonLeft: finalLeft,
      buttonTop: finalTop,
      chatLeft,
      chatTop,
      isAbove,
      isButtonLeft
    };
  }

  function positionChatbox(left: number, top: number): LayoutResult {
    const layout = computeLayout(left, top);
    chatbox.style.left = `${layout.chatLeft}px`;
    chatbox.style.top = `${layout.chatTop}px`;
    onResizeCornerChange(layout);
    return layout;
  }

  function applyPos(left: number, top: number): Position {
    const layout = positionChatbox(left, top);
    aiButton.style.left = `${layout.buttonLeft}px`;
    aiButton.style.top = `${layout.buttonTop}px`;
    return { left: layout.buttonLeft, top: layout.buttonTop };
  }

  function applyChatSize(width: number, height: number): Size {
    const limits = getChatSizeLimits();
    const nextWidth = clampValue(width, limits.minWidth, limits.maxWidth);
    const nextHeight = clampValue(height, limits.minHeight, limits.maxHeight);
    chatbox.style.minWidth = `${limits.minWidth}px`;
    chatbox.style.minHeight = `${limits.minHeight}px`;
    chatbox.style.maxWidth = `${limits.maxWidth}px`;
    chatbox.style.width = `${nextWidth}px`;
    chatbox.style.height = `${nextHeight}px`;
    chatbox.style.maxHeight = `${nextHeight}px`;
    return { width: nextWidth, height: nextHeight };
  }

  function normalizeViewportState(
    options: {
      left?: number;
      top?: number;
      persist?: boolean;
    } = {}
  ) {
    const { left, top, persist = false } = options;
    const currentPos = getCurrentButtonPos();
    const originalPos = {
      left: left ?? currentPos.left,
      top: top ?? currentPos.top
    };
    const originalSize = getCurrentChatSize();
    const appliedSize = applyChatSize(originalSize.width, originalSize.height);
    const appliedPos = applyPos(originalPos.left, originalPos.top);
    const positionChanged =
      appliedPos.left !== originalPos.left ||
      appliedPos.top !== originalPos.top;
    const sizeChanged =
      appliedSize.width !== originalSize.width ||
      appliedSize.height !== originalSize.height;

    if (persist) {
      if (positionChanged) {
        saveBtnPos(appliedPos.left, appliedPos.top);
      }
      if (sizeChanged && state.settingsLoaded) {
        onAutoSave();
      }
    }

    return { ...appliedPos, ...appliedSize, positionChanged, sizeChanged };
  }

  return {
    loadBtnPos,
    saveBtnPos,
    getViewportBounds,
    getCurrentButtonPos,
    getCurrentChatSize,
    getChatSizeLimits,
    positionChatbox,
    applyPos,
    applyChatSize,
    normalizeViewportState
  };
}

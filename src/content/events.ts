import type { EventBindingsOptions } from "./events/types";
import { bindDragEvents } from "./events/drag";
import { bindImageEvents } from "./events/images";
import { bindRuntimeEvents } from "./events/runtime";
import { bindSettingsEvents } from "./events/settings";

export function bindOverlayEvents({
  elements,
  state,
  posKey,
  chat,
  settings,
  layout,
  theme,
  images
}: EventBindingsOptions): void {
  bindDragEvents({ elements, state, posKey, chat, settings, layout });
  bindRuntimeEvents({ elements, state, chat, layout, theme });
  bindSettingsEvents({ elements, state, chat, settings, images });
  bindImageEvents({ elements, state, images });
}

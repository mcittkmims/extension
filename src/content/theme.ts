export function createThemeController(chatbox: HTMLDivElement) {
  return {
    updateDarkMode(): void {
      const elementsToCheck: HTMLElement[] = [
        document.documentElement,
        document.body
      ].filter((element): element is HTMLElement => Boolean(element));
      let luminance = 1;
      for (const element of elementsToCheck) {
        const bg = window.getComputedStyle(element).backgroundColor;
        const matches = bg.match(/[\d.]+/g);
        if (!matches || matches.length < 3) {
          continue;
        }

        const [r, g, b] = matches.slice(0, 3).map(Number);
        const alpha = matches[3] != null ? Number(matches[3]) : 1;
        if (alpha === 0) {
          continue;
        }

        luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        break;
      }
      chatbox.classList.toggle("ai-page-dark", luminance < 0.5);
    }
  };
}

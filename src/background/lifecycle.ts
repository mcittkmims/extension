// @ts-nocheck

export function setupLifecycle() {
  browser.runtime.onInstalled.addListener(function (details) {
    if (details.reason === "install") {
      console.log("Quick Notes: Extension installed");
    } else if (details.reason === "update") {
      console.log("Quick Notes: Extension updated");
    }
  });

  browser.menus.removeAll().then(function () {
    browser.menus.create({
      id: "quiz-screenshot",
      title: "Add to clipboard",
      contexts: ["all"]
    });
  });

  browser.menus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === "quiz-screenshot" && tab && tab.id) {
      browser.tabs.sendMessage(tab.id, { type: "quizScreenshot" });
    }
  });
}

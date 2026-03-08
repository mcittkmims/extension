import type { CaptureTabResponse, OverlayElements } from "./types";
import type { MessageController } from "./messages";

const QUIZ_PROMPT = `You are a precise quiz-answering assistant. Your only job is to find and answer the question visible in this screenshot.

RULES - follow them exactly, no exceptions:
1. Do NOT describe, summarize, or comment on the screenshot.
2. Scan the screenshot for a question (quiz, test, exercise, form field, etc.).
3. If NO question is found -> respond with exactly: no question found
4. If a MULTIPLE-CHOICE or SINGLE-CHOICE question is found -> respond with ONLY the letter or number of the correct option (e.g. "B" or "3"). No explanation.
5. If any OTHER type of question is found (fill-in, short answer, calculation, etc.) -> respond with the shortest correct answer only. No explanation, no full sentences unless the answer itself is a sentence.

Begin.`;

interface QuizControllerOptions {
  elements: OverlayElements;
  messages: MessageController;
  sendToAI: (
    text: string,
    imageBase64?: string | null,
    imageMimeType?: string | null
  ) => Promise<string>;
  captureTab: () => Promise<CaptureTabResponse>;
}

export function createQuizController({
  elements,
  messages,
  sendToAI,
  captureTab
}: QuizControllerOptions) {
  const { aiButton, chatbox } = elements;

  return {
    async runScreenshotQuiz(): Promise<void> {
      messages.addUserMessage("📸 Screenshot sent — answering quiz…");
      messages.showLoading();

      try {
        chatbox.style.display = "none";
        aiButton.style.display = "none";
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );

        let captured: CaptureTabResponse;
        try {
          captured = await captureTab();
        } finally {
          chatbox.style.display = "";
          aiButton.style.display = "";
        }

        if (!captured.success || !captured.base64 || !captured.mimeType) {
          throw new Error(captured.error || "Screenshot failed");
        }

        const response = await sendToAI(
          QUIZ_PROMPT,
          captured.base64,
          captured.mimeType
        );
        messages.hideLoading();
        messages.addBotMessage(response);
      } catch (error) {
        messages.hideLoading();
        messages.showError(error);
      }
    }
  };
}

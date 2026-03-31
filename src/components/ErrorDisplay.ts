export class ErrorDisplay {
  private containerEl: HTMLDivElement;
  private messageEl: HTMLParagraphElement;
  private retryBtn: HTMLButtonElement;

  constructor(
    containerEl: HTMLDivElement,
    messageEl: HTMLParagraphElement,
    retryBtn: HTMLButtonElement,
    onRetry: () => void
  ) {
    this.containerEl = containerEl;
    this.messageEl = messageEl;
    this.retryBtn = retryBtn;

    this.retryBtn.addEventListener("click", onRetry);
  }

  show(message: string) {
    this.containerEl.style.display = "block";
    this.messageEl.textContent = message;
  }

  hide() {
    this.containerEl.style.display = "none";
  }
}

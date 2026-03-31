export class Search {
  private inputEl: HTMLInputElement;
  private onSearch: (query: string) => void;

  constructor(
    inputEl: HTMLInputElement,
    buttonEl: HTMLButtonElement,
    onSearch: (query: string) => void
  ) {
    this.inputEl = inputEl;
    this.onSearch = onSearch;

    buttonEl.addEventListener("click", () => this.handleSearch());
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleSearch();
    });
  }

  private handleSearch() {
    const query = this.inputEl.value.trim();
    if (!query) return;
    this.onSearch(query);
  }

  clear() {
    this.inputEl.value = "";
  }
}

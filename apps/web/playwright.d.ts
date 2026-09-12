declare module 'playwright' {
  interface APIResponse {
    headers(): Readonly<Record<string, string>>;
    body(): Promise<Buffer>;
  }

  interface APIRequestContext {
    get(url: string): Promise<APIResponse>;
  }

  interface Locator {
    first(): Locator;
    waitFor(options?: {
      readonly state?: 'attached' | 'detached' | 'visible' | 'hidden';
    }): Promise<void>;
  }

  export interface Page {
    readonly request: APIRequestContext;
    goto(url: string): Promise<unknown>;
    getByTestId(testId: string): Locator;
    getByText(text: string, options?: { readonly exact?: boolean }): Locator;
    screenshot(options: { readonly path: string; readonly fullPage?: boolean }): Promise<Buffer>;
    evaluate<T>(pageFunction: () => T): Promise<T>;
    waitForFunction(pageFunction: () => boolean): Promise<unknown>;
  }

  interface Browser {
    newPage(options?: {
      readonly viewport?: { readonly width: number; readonly height: number };
      readonly isMobile?: boolean;
      readonly hasTouch?: boolean;
    }): Promise<Page>;
    close(): Promise<void>;
  }

  export const chromium: {
    launch(options?: { readonly headless?: boolean }): Promise<Browser>;
  };
}

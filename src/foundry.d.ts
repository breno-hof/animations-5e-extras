/**
 * Minimal ambient declarations for the parts of the Foundry VTT v13/v14 client
 * API and of Automated Animations this module touches. Hand-written and
 * deliberately narrow.
 */

interface FoundrySettingConfig<T> {
  name?: string;
  hint?: string;
  scope: 'world' | 'client';
  config: boolean;
  type: unknown;
  default: T;
  choices?: Record<string, string>;
  restricted?: boolean;
}

interface FoundrySettingMenuConfig {
  name: string;
  label: string;
  hint?: string;
  icon: string;
  type: unknown;
  restricted: boolean;
}

interface FoundryUser {
  readonly isSelf: boolean;
  readonly isGM: boolean;
}

declare const game: {
  settings: {
    register<T>(namespace: string, key: string, config: FoundrySettingConfig<T>): void;
    registerMenu(namespace: string, key: string, config: FoundrySettingMenuConfig): void;
    get(namespace: string, key: string): unknown;
    set(namespace: string, key: string, value: unknown): Promise<unknown>;
  };
  user: FoundryUser;
  users: { activeGM: FoundryUser | null };
  modules: { get(id: string): { version: string; active: boolean } | undefined };
  i18n: {
    localize(key: string): string;
    format(key: string, data: Record<string, string | number>): string;
  };
};

declare const Hooks: {
  once(hook: string, callback: (...args: unknown[]) => unknown): void;
};

declare const ui: {
  notifications: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  };
};

interface AutomatedAnimationsApi {
  AutorecManager: {
    getMenu(menu: string): unknown[];
    setMenu(menu: string, entries: unknown[]): Promise<unknown>;
  };
}

declare const AutomatedAnimations: AutomatedAnimationsApi | undefined;

declare namespace foundry {
  namespace applications.api {
    interface DialogV2Button {
      action: string;
      label: string;
      icon?: string;
      default?: boolean;
      callback?: (event: Event, button: HTMLButtonElement, dialog: unknown) => unknown;
    }
    class DialogV2 {
      static wait(options: {
        window?: { title?: string; icon?: string };
        position?: { width?: number | 'auto'; height?: number | 'auto' };
        classes?: string[];
        content?: string;
        buttons: DialogV2Button[];
        rejectClose?: boolean;
        modal?: boolean;
      }): Promise<unknown>;
    }
    class ApplicationV2 {
      constructor(options?: object);
      render(options?: { force?: boolean } | boolean): Promise<this>;
    }
  }
  namespace utils {
    function randomID(length?: number): string;
  }
}

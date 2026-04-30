/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_SOCKET_URL?: string;
  readonly VITE_API_PROXY?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (cfg: {
          client_id: string;
          callback: (resp: { credential: string }) => void;
          auto_select?: boolean;
          cancel_on_tap_outside?: boolean;
        }) => void;
        renderButton: (
          el: HTMLElement,
          opts: {
            type?: 'standard' | 'icon';
            theme?: 'outline' | 'filled_blue' | 'filled_black';
            size?: 'small' | 'medium' | 'large';
            text?: 'signin_with' | 'signup_with' | 'continue_with';
            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
            width?: number | string;
            logo_alignment?: 'left' | 'center';
          }
        ) => void;
        prompt: () => void;
        disableAutoSelect: () => void;
      };
    };
  };
}

import { FC, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAppDispatch } from '@/store';
import { googleLoginThunk } from '@/store/slices/authSlice';

interface Props {
  onSuccess?: () => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const GoogleSignInButton: FC<Props> = ({ onSuccess, text = 'continue_with' }) => {
  const dispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;

    let attempts = 0;
    const tryRender = () => {
      if (!window.google?.accounts?.id) {
        if (attempts++ < 40) {
          window.setTimeout(tryRender, 150);
        }
        return;
      }
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }: { credential: string }) => {
          const result = await dispatch(googleLoginThunk(credential));
          if (googleLoginThunk.fulfilled.match(result)) {
            toast.success('Signed in with Google');
            onSuccess?.();
          } else {
            toast.error((result.payload as string) || 'Google sign-in failed');
          }
        },
        cancel_on_tap_outside: true,
      });
      if (containerRef.current) {
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          width: 320,
          logo_alignment: 'center',
        });
      }
    };
    tryRender();
  }, [dispatch, onSuccess, text]);

  if (!CLIENT_ID) {
    return (
      <div className="text-xs muted" style={{ textAlign: 'center', padding: '8px 0' }}>
        Google Sign-In is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> to enable.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }}>
      <div ref={containerRef} />
    </div>
  );
};

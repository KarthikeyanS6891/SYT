import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type AuthModalMode = 'login' | 'register';

interface UiState {
  unreadCount: number;
  authModal: { open: boolean; mode: AuthModalMode };
  theme: 'light' | 'dark';
}

const initialState: UiState = {
  unreadCount: 0,
  authModal: { open: false, mode: 'login' },
  theme: 'light',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setUnread(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    },
    bumpUnread(state) {
      state.unreadCount += 1;
    },
    resetUnread(state) {
      state.unreadCount = 0;
    },
    openAuthModal(state, action: PayloadAction<AuthModalMode | undefined>) {
      state.authModal.open = true;
      state.authModal.mode = action.payload || 'login';
    },
    closeAuthModal(state) {
      state.authModal.open = false;
    },
    setAuthMode(state, action: PayloadAction<AuthModalMode>) {
      state.authModal.mode = action.payload;
    },
    setTheme(state, action: PayloadAction<'light' | 'dark'>) {
      state.theme = action.payload;
    },
  },
});

export const {
  setUnread,
  bumpUnread,
  resetUnread,
  openAuthModal,
  closeAuthModal,
  setAuthMode,
  setTheme,
} = uiSlice.actions;
export default uiSlice.reducer;

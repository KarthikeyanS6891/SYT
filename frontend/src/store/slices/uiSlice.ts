import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  unreadCount: number;
}

const initialState: UiState = { unreadCount: 0 };

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
  },
});

export const { setUnread, bumpUnread, resetUnread } = uiSlice.actions;
export default uiSlice.reducer;

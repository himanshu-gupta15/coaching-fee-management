import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '@/services/api';

export const fetchUnread = createAsyncThunk('ui/unread', async () => {
  const { data } = await api.get('/notifications', { params: { limit: 1, unread: 'true' } });
  return (data.meta?.unreadCount as number) ?? 0;
});

const slice = createSlice({
  name: 'ui',
  initialState: { unread: 0, mobileNavOpen: false },
  reducers: {
    setMobileNav(s, a: { payload: boolean }) { s.mobileNavOpen = a.payload; },
    setUnread(s, a: { payload: number }) { s.unread = a.payload; },
  },
  extraReducers: (b) => { b.addCase(fetchUnread.fulfilled, (s, a) => { s.unread = a.payload; }); },
});
export const { setMobileNav, setUnread } = slice.actions;
export default slice.reducer;

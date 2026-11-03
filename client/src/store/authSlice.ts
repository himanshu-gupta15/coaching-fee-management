import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { api, tokenStore, apiError } from '@/services/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'ready';
  error: string | null;
}
const initialState: AuthState = { user: null, status: tokenStore.get() ? 'idle' : 'ready', error: null };

export const login = createAsyncThunk('auth/login', async (body: { email: string; password: string }, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', body);
    tokenStore.set(data.data.token);
    return data.data.user as User;
  } catch (e) {
    return rejectWithValue(apiError(e).message);
  }
});

export const loadSession = createAsyncThunk('auth/me', async (_: void, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/auth/me');
    return data.data.user as User;
  } catch (e) {
    tokenStore.clear();
    return rejectWithValue(apiError(e).message);
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  try { await api.post('/auth/logout'); } catch { /* token may already be invalid */ }
  tokenStore.clear();
});

const slice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionExpired(state) {
      tokenStore.clear();
      state.user = null;
      state.status = 'ready';
      state.error = 'Your session has expired. Please sign in again.';
    },
    clearError(state) { state.error = null; },
    setUser(state, a: PayloadAction<User>) { state.user = a.payload; },
  },
  extraReducers: (b) => {
    b.addCase(login.pending, (s) => { s.error = null; })
      .addCase(login.fulfilled, (s, a) => { s.user = a.payload; s.status = 'ready'; })
      .addCase(login.rejected, (s, a) => { s.error = (a.payload as string) ?? 'Login failed'; })
      .addCase(loadSession.pending, (s) => { s.status = 'loading'; })
      .addCase(loadSession.fulfilled, (s, a) => { s.user = a.payload; s.status = 'ready'; })
      .addCase(loadSession.rejected, (s) => { s.user = null; s.status = 'ready'; })
      .addCase(logout.fulfilled, (s) => { s.user = null; s.status = 'ready'; s.error = null; });
  },
});

export const { sessionExpired, clearError, setUser } = slice.actions;
export default slice.reducer;

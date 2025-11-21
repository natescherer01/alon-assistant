/**
 * Chat state management using Zustand
 * Persists messages globally across navigation to avoid reloading
 */
import { create } from 'zustand';
import { chatAPI } from '../api/client';
import { setChatStoreReset } from './authStore';

const useChatStore = create((set, get) => ({
  // State
  messages: [],
  isLoadingHistory: false,
  isLoadingMessage: false,
  hasLoadedHistory: false, // Track if we've already loaded history once
  error: null,

  // Load chat history (only once per session)
  loadHistory: async (force = false) => {
    const { hasLoadedHistory } = get();

    // Skip if already loaded (unless forced)
    if (hasLoadedHistory && !force) {
      console.log('📝 Chat history already loaded, skipping fetch');
      return;
    }

    set({ isLoadingHistory: true, error: null });
    try {
      const history = await chatAPI.getHistory(20);
      const formattedMessages = history.flatMap((msg) => [
        { role: 'user', content: msg.message, timestamp: msg.created_at },
        { role: 'assistant', content: msg.response, timestamp: msg.created_at },
      ]);

      set({
        messages: formattedMessages,
        hasLoadedHistory: true,
        isLoadingHistory: false,
      });

      console.log('✅ Chat history loaded:', formattedMessages.length, 'messages');
    } catch (error) {
      console.error('❌ Failed to load chat history:', error);
      set({ error: 'Failed to load chat history', isLoadingHistory: false });
    }
  },

  // Send a message (optimistic update + backend sync)
  sendMessage: async (userMessage, onTaskUpdate) => {
    const { messages } = get();

    // Optimistic update: add user message immediately
    const userMsg = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };

    set({
      messages: [...messages, userMsg],
      isLoadingMessage: true,
      error: null,
    });

    try {
      // Send to backend
      const response = await chatAPI.sendMessage(userMessage);

      // Add assistant response
      const assistantMsg = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      };

      set((state) => ({
        messages: [...state.messages, assistantMsg],
        isLoadingMessage: false,
      }));

      // Notify parent if tasks were updated
      if (response.task_updates && response.task_updates.length > 0) {
        onTaskUpdate?.();
      }

      console.log('✅ Message sent successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to send message';

      // Add error message
      const errorMsg = {
        role: 'error',
        content: `Error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      };

      set((state) => ({
        messages: [...state.messages, errorMsg],
        isLoadingMessage: false,
        error: errorMessage,
      }));

      console.error('❌ Failed to send message:', errorMessage);
      return { success: false, error: errorMessage };
    }
  },

  // Clear all messages
  clearHistory: async () => {
    try {
      await chatAPI.clearHistory();
      set({ messages: [], hasLoadedHistory: false });
      console.log('✅ Chat history cleared');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message;
      set({ error: errorMessage });
      console.error('❌ Failed to clear chat history:', errorMessage);
      return { success: false, error: errorMessage };
    }
  },

  // Reset state (on logout)
  reset: () => {
    set({
      messages: [],
      isLoadingHistory: false,
      isLoadingMessage: false,
      hasLoadedHistory: false,
      error: null,
    });
    console.log('🔄 Chat store reset');
  },
}));

// Register reset function with auth store
setChatStoreReset(() => {
  useChatStore.getState().reset();
});

export default useChatStore;

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
  isStreaming: false, // New: track if currently streaming
  streamingContent: '', // New: current streaming content
  hasLoadedHistory: false, // Track if we've already loaded history once
  error: null,
  abortStream: null, // New: function to abort current stream

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

  // Send a message with streaming response
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
      isStreaming: true,
      streamingContent: '',
      error: null,
    });

    // Use streaming API
    const abort = chatAPI.sendMessageStream(
      userMessage,
      // onToken - called for each token received
      (token) => {
        console.log('🔤 Token received:', token.substring(0, 30));
        set((state) => {
          const newContent = state.streamingContent + token;
          console.log('📝 Streaming content length:', newContent.length);
          return { streamingContent: newContent };
        });
      },
      // onDone - called when streaming is complete
      (taskUpdates) => {
        const { streamingContent } = get();

        // Clean the response (remove ACTION lines)
        let cleanedContent = streamingContent;
        cleanedContent = cleanedContent.replace(/^ACTION:.*$\n?/gm, '');
        cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
        cleanedContent = cleanedContent.trim();

        // Add assistant response as a complete message
        const assistantMsg = {
          role: 'assistant',
          content: cleanedContent,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          messages: [...state.messages, assistantMsg],
          isLoadingMessage: false,
          isStreaming: false,
          streamingContent: '',
          abortStream: null,
        }));

        // Notify parent if tasks were updated
        if (taskUpdates && taskUpdates.length > 0) {
          onTaskUpdate?.();
        }

        console.log('✅ Streaming message completed');
      },
      // onError - called on error
      (error) => {
        const errorMessage = error.message || 'Failed to send message';

        // Add error message
        const errorMsg = {
          role: 'error',
          content: `Error: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          messages: [...state.messages, errorMsg],
          isLoadingMessage: false,
          isStreaming: false,
          streamingContent: '',
          error: errorMessage,
          abortStream: null,
        }));

        console.error('❌ Failed to send message:', errorMessage);
      }
    );

    // Store abort function
    set({ abortStream: abort });

    return { success: true };
  },

  // Stop current stream
  stopStreaming: () => {
    const { abortStream, streamingContent } = get();

    if (abortStream) {
      abortStream();

      // If we have partial content, save it as a message
      if (streamingContent.trim()) {
        let cleanedContent = streamingContent;
        cleanedContent = cleanedContent.replace(/^ACTION:.*$\n?/gm, '');
        cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
        cleanedContent = cleanedContent.trim();

        const assistantMsg = {
          role: 'assistant',
          content: cleanedContent + '\n\n*[Response interrupted]*',
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          messages: [...state.messages, assistantMsg],
        }));
      }

      set({
        isLoadingMessage: false,
        isStreaming: false,
        streamingContent: '',
        abortStream: null,
      });

      console.log('⏹️ Streaming stopped by user');
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
    const { abortStream } = get();
    if (abortStream) {
      abortStream(); // Abort any ongoing stream
    }

    set({
      messages: [],
      isLoadingHistory: false,
      isLoadingMessage: false,
      isStreaming: false,
      streamingContent: '',
      hasLoadedHistory: false,
      error: null,
      abortStream: null,
    });
    console.log('🔄 Chat store reset');
  },
}));

// Register reset function with auth store
setChatStoreReset(() => {
  useChatStore.getState().reset();
});

export default useChatStore;

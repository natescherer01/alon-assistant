import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatAPI } from '../api/client';
import useAuthStore from '../utils/authStore';

function ChatInterface({ onTaskUpdate }) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadHistory = async () => {
    try {
      const history = await chatAPI.getHistory(20);
      const formattedMessages = history.flatMap((msg) => [
        { role: 'user', content: msg.message, timestamp: msg.created_at },
        { role: 'assistant', content: msg.response, timestamp: msg.created_at },
      ]);
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Add user message to UI
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
    ]);

    setIsLoading(true);

    try {
      const response = await chatAPI.sendMessage(userMessage);

      // Add assistant response to UI
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.response,
          timestamp: new Date().toISOString(),
        },
      ]);

      // If tasks were updated, notify parent component
      if (response.task_updates && response.task_updates.length > 0) {
        onTaskUpdate?.();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to send message';
      setMessages((prev) => [
        ...prev,
        {
          role: 'error',
          content: `Error: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear all chat history? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      await chatAPI.clearHistory();
      setMessages([]);
    } catch (error) {
      alert('Failed to clear chat history: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Get user initials for avatar
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%',
      padding: '24px',
    }}>
      {/* Messages Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        marginBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>
        {isLoadingHistory ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(0, 0, 0, 0.4)',
            fontSize: '16px',
          }}>
            Loading chat history...
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <p style={{ color: 'rgba(0, 0, 0, 0.4)', fontSize: '18px' }}>
              Start a conversation with Sam
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '40px',
                height: '40px',
                minWidth: '40px',
                borderRadius: '50%',
                background: msg.role === 'user' ? '#0066FF' : '#F3F4F6',
                color: msg.role === 'user' ? '#fff' : '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: msg.role === 'user' ? '14px' : '18px',
                fontWeight: msg.role === 'user' ? '600' : '400',
                overflow: 'hidden',
              }}>
                {msg.role === 'user' ? (
                  getInitials(user?.full_name || user?.email)
                ) : (
                  <img src="/Sam.png" alt="Sam" style={{ width: '40px', height: '40px', objectFit: 'cover' }} />
                )}
              </div>

              {/* Message Bubble */}
              <div style={{
                maxWidth: '70%',
                padding: '14px 18px',
                background: msg.role === 'user' ? '#0066FF' : msg.role === 'error' ? '#FEE2E2' : '#F3F4F6',
                color: msg.role === 'user' ? '#fff' : msg.role === 'error' ? '#DC2626' : '#000',
                borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                fontSize: '14px',
                lineHeight: '1.5',
                wordBreak: 'break-word',
              }}>
                {msg.role === 'user' || msg.role === 'error' ? (
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                ) : (
                  <div style={{
                    fontSize: '14px',
                    lineHeight: '1.5',
                  }}>
                    <ReactMarkdown
                      components={{
                        p: ({node, ...props}) => <p style={{ margin: '0 0 6px 0', fontSize: '14px' }} {...props} />,
                        ul: ({node, ...props}) => <ul style={{ margin: '6px 0', paddingLeft: '18px', fontSize: '14px' }} {...props} />,
                        ol: ({node, ...props}) => <ol style={{ margin: '6px 0', paddingLeft: '18px', fontSize: '14px' }} {...props} />,
                        li: ({node, ...props}) => <li style={{ margin: '3px 0', fontSize: '14px' }} {...props} />,
                        h1: ({node, ...props}) => (
                          <h1 style={{
                            fontSize: '15px',
                            fontWeight: '700',
                            margin: '12px 0 6px 0',
                            color: '#0066FF',
                          }} {...props} />
                        ),
                        h2: ({node, ...props}) => (
                          <h2 style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            margin: '10px 0 5px 0',
                            color: '#0066FF',
                          }} {...props} />
                        ),
                        h3: ({node, ...props}) => (
                          <h3 style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            margin: '8px 0 4px 0',
                            color: '#0066FF',
                          }} {...props} />
                        ),
                        strong: ({node, ...props}) => <strong style={{ fontWeight: '600', color: '#1a1a1a', fontSize: '14px' }} {...props} />,
                        blockquote: ({node, ...props}) => (
                          <blockquote style={{
                            borderLeft: '3px solid #0066FF',
                            margin: '8px 0',
                            background: 'rgba(0, 102, 255, 0.08)',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            lineHeight: '1.5',
                            boxShadow: '0 1px 2px rgba(0, 102, 255, 0.1)',
                          }} {...props} />
                        ),
                        code: ({node, inline, ...props}) => inline ? (
                          <code style={{
                            background: 'rgba(0, 0, 0, 0.05)',
                            padding: '2px 5px',
                            borderRadius: '3px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                          }} {...props} />
                        ) : (
                          <code style={{
                            display: 'block',
                            background: 'rgba(0, 0, 0, 0.05)',
                            padding: '8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            margin: '6px 0',
                          }} {...props} />
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}>
            {/* Assistant Avatar */}
            <div style={{
              width: '40px',
              height: '40px',
              minWidth: '40px',
              borderRadius: '50%',
              background: '#F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <img src="/Sam.png" alt="Sam" style={{ width: '40px', height: '40px', objectFit: 'cover' }} />
            </div>

            {/* Typing Indicator */}
            <div style={{
              padding: '16px 20px',
              background: '#F3F4F6',
              borderRadius: '20px 20px 20px 4px',
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#999',
                animation: 'bounce 1.4s infinite ease-in-out both',
                animationDelay: '-0.32s',
              }} />
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#999',
                animation: 'bounce 1.4s infinite ease-in-out both',
                animationDelay: '-0.16s',
              }} />
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#999',
                animation: 'bounce 1.4s infinite ease-in-out both',
              }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Clear Chat Button */}
      {messages.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '12px',
        }}>
          <button
            onClick={handleClearChat}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '500',
              color: '#666',
              background: 'transparent',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(239, 68, 68, 0.1)';
              e.target.style.borderColor = '#EF4444';
              e.target.style.color = '#DC2626';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.borderColor = 'rgba(0, 0, 0, 0.1)';
              e.target.style.color = '#666';
            }}
          >
            Clear Chat
          </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        gap: '12px',
        padding: '16px',
        background: '#F9FAFB',
        borderRadius: '16px',
        border: '1px solid rgba(0, 0, 0, 0.06)',
      }}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '12px 16px',
            fontSize: '15px',
            border: 'none',
            borderRadius: '12px',
            background: '#fff',
            outline: 'none',
            color: '#000',
          }}
        />
        <button
          type="submit"
          disabled={!inputMessage.trim() || isLoading}
          style={{
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '600',
            color: '#fff',
            background: '#0066FF',
            border: 'none',
            borderRadius: '12px',
            cursor: (!inputMessage.trim() || isLoading) ? 'not-allowed' : 'pointer',
            opacity: (!inputMessage.trim() || isLoading) ? 0.5 : 1,
            transition: 'all 0.2s',
          }}
        >
          Send
        </button>
      </form>

      {/* Bounce Animation Styles */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

export default ChatInterface;

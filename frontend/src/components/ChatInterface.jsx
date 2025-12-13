import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import useAuthStore from '../utils/authStore';
import useChatStore from '../utils/chatStore';
import useConfirm from '../hooks/useConfirm';
import { useIsMobile } from '../hooks/useIsMobile';

function ChatInterface({ onTaskUpdate }) {
  const { user } = useAuthStore();
  const isMobile = useIsMobile(640);
  const { ConfirmDialog, confirm, alert } = useConfirm();

  // Use global chat store instead of local state
  const {
    messages,
    isLoadingHistory,
    isLoadingMessage,
    isStreaming,
    streamingContent,
    loadHistory,
    sendMessage,
    clearHistory,
    stopStreaming,
  } = useChatStore();

  const [inputMessage, setInputMessage] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load history only once (global store prevents duplicate loads)
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Auto-scroll when messages or streaming content change
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!inputMessage.trim() || isLoadingMessage) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Send message (optimistic update handled by store)
    await sendMessage(userMessage, onTaskUpdate);
  };

  const handleClearChat = async () => {
    const confirmed = await confirm(
      'Clear chat history?',
      'Are you sure you want to clear all chat history? This action cannot be undone.',
      'Clear History',
      'Cancel'
    );

    if (!confirmed) return;

    const result = await clearHistory();
    if (!result.success) {
      await alert('Failed to clear chat history', result.error);
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
    <>
      <ConfirmDialog />
      <div className="chat-container" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
        padding: isMobile ? '16px' : '32px 24px',
      }}>
        {/* Messages Container */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {isLoadingHistory ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 24px',
            }}>
              <div className="chat-loading-spinner" style={{
                width: '32px',
                height: '32px',
                border: '2px solid #E5E7EB',
                borderTopColor: '#0066FF',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          ) : messages.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '60px 24px',
              animation: 'fadeIn 0.5s ease-out',
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#F3F4F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                overflow: 'hidden',
              }}>
                <img src="/Sam.png" alt="Sam" style={{ width: '64px', height: '64px', objectFit: 'cover' }} />
              </div>
              <p style={{
                color: '#6B7280',
                fontSize: '15px',
                fontWeight: '500',
                margin: 0,
              }}>
                How can I help you today?
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className="chat-message"
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  animation: 'messageSlideIn 0.3s ease-out',
                  animationFillMode: 'backwards',
                  animationDelay: `${Math.min(index * 0.05, 0.3)}s`,
                }}
              >
                {/* Avatar */}
                <div className="chat-avatar" style={{
                  width: isMobile ? '36px' : '40px',
                  height: isMobile ? '36px' : '40px',
                  minWidth: isMobile ? '36px' : '40px',
                  borderRadius: '50%',
                  background: msg.role === 'user' ? '#0066FF' : '#F3F4F6',
                  color: msg.role === 'user' ? '#fff' : '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: msg.role === 'user' ? (isMobile ? '13px' : '14px') : '18px',
                  fontWeight: msg.role === 'user' ? '600' : '400',
                  overflow: 'hidden',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}>
                  {msg.role === 'user' ? (
                    getInitials(user?.full_name || user?.email)
                  ) : (
                    <img src="/Sam.png" alt="Sam" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>

                {/* Message Bubble */}
                <div className="chat-message-bubble" style={{
                  maxWidth: isMobile ? '82%' : '70%',
                  padding: isMobile ? '14px 16px' : '16px 20px',
                  background: msg.role === 'user'
                    ? '#0066FF'
                    : msg.role === 'error'
                      ? '#FEF2F2'
                      : '#FFFFFF',
                  color: msg.role === 'user' ? '#fff' : msg.role === 'error' ? '#DC2626' : '#1F2937',
                  borderRadius: msg.role === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                  fontSize: '15px',
                  lineHeight: '1.6',
                  wordBreak: 'break-word',
                  boxShadow: msg.role === 'user'
                    ? '0 2px 12px rgba(0, 102, 255, 0.2)'
                    : '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
                  border: msg.role === 'user' ? 'none' : msg.role === 'error' ? '1px solid #FECACA' : '1px solid rgba(0, 0, 0, 0.04)',
                }}>
                  {msg.role === 'user' || msg.role === 'error' ? (
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '15px' }}>{msg.content}</p>
                  ) : (
                    <div className="chat-markdown" style={{
                      fontSize: '15px',
                      lineHeight: '1.6',
                    }}>
                      <ReactMarkdown
                        components={{
                          p: ({node, ...props}) => <p style={{ margin: '0 0 8px 0', fontSize: '15px', lineHeight: '1.6' }} {...props} />,
                          ul: ({node, ...props}) => <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '15px' }} {...props} />,
                          ol: ({node, ...props}) => <ol style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '15px' }} {...props} />,
                          li: ({node, ...props}) => <li style={{ margin: '4px 0', fontSize: '15px', lineHeight: '1.6' }} {...props} />,
                          h1: ({node, ...props}) => (
                            <h1 style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              margin: '16px 0 8px 0',
                              color: '#111827',
                            }} {...props} />
                          ),
                          h2: ({node, ...props}) => (
                            <h2 style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              margin: '14px 0 6px 0',
                              color: '#111827',
                            }} {...props} />
                          ),
                          h3: ({node, ...props}) => (
                            <h3 style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              margin: '12px 0 4px 0',
                              color: '#111827',
                            }} {...props} />
                          ),
                          strong: ({node, ...props}) => <strong style={{ fontWeight: '600', color: '#111827' }} {...props} />,
                          blockquote: ({node, ...props}) => (
                            <blockquote style={{
                              borderLeft: '3px solid #E5E7EB',
                              margin: '12px 0',
                              background: '#F9FAFB',
                              padding: '12px 16px',
                              borderRadius: '0 8px 8px 0',
                              fontSize: '14px',
                              lineHeight: '1.6',
                              color: '#4B5563',
                            }} {...props} />
                          ),
                          code: ({node, inline, ...props}) => inline ? (
                            <code style={{
                              background: '#F3F4F6',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                              color: '#0066FF',
                            }} {...props} />
                          ) : (
                            <code style={{
                              display: 'block',
                              background: '#F9FAFB',
                              padding: '12px 16px',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                              margin: '8px 0',
                              overflowX: 'auto',
                              border: '1px solid #E5E7EB',
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

          {/* Streaming Message Display - Clean Modern Style */}
          {isStreaming && streamingContent && (
            <div
              className="chat-message"
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                animation: 'messageSlideIn 0.3s ease-out',
              }}
            >
              {/* Assistant Avatar */}
              <div style={{
                width: isMobile ? '36px' : '40px',
                height: isMobile ? '36px' : '40px',
                minWidth: isMobile ? '36px' : '40px',
                borderRadius: '50%',
                background: '#F3F4F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              }}>
                <img src="/Sam.png" alt="Sam" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              {/* Clean Streaming Bubble */}
              <div style={{
                maxWidth: isMobile ? '82%' : '70%',
                padding: isMobile ? '14px 16px' : '16px 20px',
                background: '#FFFFFF',
                borderRadius: '20px 20px 20px 6px',
                fontSize: '15px',
                lineHeight: '1.6',
                wordBreak: 'break-word',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
                border: '1px solid rgba(0, 0, 0, 0.04)',
                position: 'relative',
              }}>
                <div style={{
                  color: '#1F2937',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {streamingContent.replace(/^ACTION:.*$\n?/gm, '').trim()}
                  <span className="typing-cursor" style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '18px',
                    background: '#0066FF',
                    marginLeft: '2px',
                    animation: 'cursorBlink 1s ease-in-out infinite',
                    verticalAlign: 'text-bottom',
                    borderRadius: '1px',
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* Loading Indicator - Elegant Wave Animation */}
          {isLoadingMessage && !streamingContent && (
            <div
              className="chat-message"
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                animation: 'messageSlideIn 0.3s ease-out',
              }}
            >
              {/* Assistant Avatar */}
              <div style={{
                width: isMobile ? '36px' : '40px',
                height: isMobile ? '36px' : '40px',
                minWidth: isMobile ? '36px' : '40px',
                borderRadius: '50%',
                background: '#F3F4F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              }}>
                <img src="/Sam.png" alt="Sam" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              {/* Minimal Typing Indicator */}
              <div style={{
                padding: '18px 24px',
                background: '#FFFFFF',
                borderRadius: '20px 20px 20px 6px',
                display: 'flex',
                gap: '5px',
                alignItems: 'center',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
                border: '1px solid rgba(0, 0, 0, 0.04)',
              }}>
                <div className="typing-dot" style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#0066FF',
                  animation: 'typingWave 1.4s ease-in-out infinite',
                  animationDelay: '0s',
                }} />
                <div className="typing-dot" style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#0066FF',
                  animation: 'typingWave 1.4s ease-in-out infinite',
                  animationDelay: '0.15s',
                }} />
                <div className="typing-dot" style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#0066FF',
                  animation: 'typingWave 1.4s ease-in-out infinite',
                  animationDelay: '0.3s',
                }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Clear Chat Button - Subtle */}
        {messages.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '16px',
          }}>
            <button
              onClick={handleClearChat}
              className="clear-chat-btn"
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#9CA3AF',
                background: 'transparent',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#FEF2F2';
                e.target.style.color = '#EF4444';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = '#9CA3AF';
              }}
            >
              Clear conversation
            </button>
          </div>
        )}

        {/* Input Form - Modern Floating Style */}
        <form onSubmit={handleSubmit} className="chat-input-container" style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '10px' : '12px',
          padding: isMobile ? '12px 14px' : '14px 16px',
          background: '#FFFFFF',
          borderRadius: '24px',
          boxShadow: inputFocused
            ? '0 0 0 2px rgba(0, 102, 255, 0.2), 0 4px 16px rgba(0, 0, 0, 0.08)'
            : '0 2px 12px rgba(0, 0, 0, 0.06)',
          border: inputFocused ? '1px solid #0066FF' : '1px solid rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease',
        }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="Message SAM..."
            disabled={isLoadingMessage}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: '15px',
              border: 'none',
              borderRadius: '16px',
              background: 'transparent',
              outline: 'none',
              color: '#1F2937',
              minHeight: '44px',
            }}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="chat-stop-btn"
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#fff',
                background: '#EF4444',
                border: 'none',
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: isMobile ? '100%' : 'auto',
                minHeight: '44px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#DC2626';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#EF4444';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoadingMessage}
              className="chat-send-btn"
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#fff',
                background: (!inputMessage.trim() || isLoadingMessage) ? '#E5E7EB' : '#0066FF',
                border: 'none',
                borderRadius: '16px',
                cursor: (!inputMessage.trim() || isLoadingMessage) ? 'default' : 'pointer',
                transition: 'all 0.2s ease',
                width: isMobile ? '100%' : 'auto',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
              onMouseEnter={(e) => {
                if (inputMessage.trim() && !isLoadingMessage) {
                  e.currentTarget.style.background = '#0052CC';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={(e) => {
                if (inputMessage.trim() && !isLoadingMessage) {
                  e.currentTarget.style.background = '#0066FF';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              Send
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          )}
        </form>

        {/* Animation Styles */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes messageSlideIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes typingWave {
            0%, 60%, 100% {
              transform: translateY(0);
              opacity: 0.4;
            }
            30% {
              transform: translateY(-6px);
              opacity: 1;
            }
          }

          @keyframes cursorBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }

          .chat-message-bubble:last-child p:last-child {
            margin-bottom: 0 !important;
          }

          .chat-markdown p:last-child {
            margin-bottom: 0 !important;
          }
        `}</style>
      </div>
    </>
  );
}

export default ChatInterface;

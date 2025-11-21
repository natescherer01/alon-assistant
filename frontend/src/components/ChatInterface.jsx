import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import useAuthStore from '../utils/authStore';
import useChatStore from '../utils/chatStore';

function ChatInterface({ onTaskUpdate }) {
  const { user } = useAuthStore();

  // Use global chat store instead of local state
  const {
    messages,
    isLoadingHistory,
    isLoadingMessage,
    loadHistory,
    sendMessage,
    clearHistory,
  } = useChatStore();

  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load history only once (global store prevents duplicate loads)
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!inputMessage.trim() || isLoadingMessage) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Send message (optimistic update handled by store)
    await sendMessage(userMessage, onTaskUpdate);
  };

  const handleClearChat = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear all chat history? This action cannot be undone.'
    );

    if (!confirmed) return;

    const result = await clearHistory();
    if (!result.success) {
      alert('Failed to clear chat history: ' + result.error);
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
            flexDirection: 'column',
            gap: '24px',
            padding: '48px 24px',
          }}>
            {/* Animated Sam Avatar */}
            <div style={{
              position: 'relative',
              animation: 'float 2s ease-in-out infinite',
            }}>
              <div style={{
                position: 'absolute',
                inset: '-8px',
                background: 'radial-gradient(circle, rgba(0, 102, 255, 0.2) 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(16px)',
                animation: 'pulse-glow 1.5s ease-in-out infinite',
              }} />
              <div style={{
                position: 'relative',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                border: '3px solid rgba(0, 102, 255, 0.15)',
                boxShadow: '0 4px 20px rgba(0, 102, 255, 0.15)',
              }}>
                <img
                  src="/Sam.png"
                  alt="Sam"
                  style={{
                    width: '80px',
                    height: '80px',
                    objectFit: 'cover'
                  }}
                />
              </div>
            </div>

            {/* Loading Text */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <span style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #0066FF 0%, #0052CC 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  Loading your conversation
                </span>
                {/* Animated dots */}
                <div style={{
                  display: 'flex',
                  gap: '4px',
                  alignItems: 'center',
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#0066FF',
                    animation: 'bounce-dot 1.4s ease-in-out infinite',
                    animationDelay: '0s',
                  }} />
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#0066FF',
                    animation: 'bounce-dot 1.4s ease-in-out infinite',
                    animationDelay: '0.2s',
                  }} />
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#0066FF',
                    animation: 'bounce-dot 1.4s ease-in-out infinite',
                    animationDelay: '0.4s',
                  }} />
                </div>
              </div>

              <p style={{
                color: 'rgba(0, 0, 0, 0.5)',
                fontSize: '14px',
                margin: 0,
                fontWeight: '400',
              }}>
                Retrieving your chat history with Sam
              </p>
            </div>

            {/* Progress indicator */}
            <div style={{
              width: '200px',
              height: '3px',
              background: 'rgba(0, 102, 255, 0.1)',
              borderRadius: '3px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: '40%',
                background: 'linear-gradient(90deg, #0066FF 0%, #0052CC 100%)',
                borderRadius: '3px',
                animation: 'loading-bar 1.5s ease-in-out infinite',
                boxShadow: '0 0 10px rgba(0, 102, 255, 0.5)',
              }} />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            flexDirection: 'column',
            gap: '32px',
            padding: '48px 24px',
          }}>
            {/* Sam's Avatar with Glow Effect */}
            <div style={{
              position: 'relative',
              animation: 'float 3s ease-in-out infinite',
            }}>
              <div style={{
                position: 'absolute',
                inset: '-12px',
                background: 'radial-gradient(circle, rgba(0, 102, 255, 0.15) 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(20px)',
                animation: 'pulse-glow 2s ease-in-out infinite',
              }} />
              <div style={{
                position: 'relative',
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                border: '4px solid rgba(0, 102, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 102, 255, 0.15)',
              }}>
                <img
                  src="/Sam.png"
                  alt="Sam"
                  style={{
                    width: '120px',
                    height: '120px',
                    objectFit: 'cover'
                  }}
                />
              </div>
            </div>

            {/* Welcome Message */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxWidth: '600px',
            }}>
              <h2 style={{
                fontSize: '32px',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #0066FF 0%, #0052CC 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                margin: 0,
                letterSpacing: '-0.5px',
              }}>
                Hey there! I'm Sam
              </h2>
              <p style={{
                color: 'rgba(0, 0, 0, 0.6)',
                fontSize: '18px',
                lineHeight: '1.6',
                margin: 0,
                fontWeight: '400',
              }}>
                Your AI-powered task assistant. Ask me anything or tell me what you'd like to accomplish today.
              </p>
            </div>

            {/* Suggested Prompts */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              width: '100%',
              maxWidth: '800px',
              marginTop: '8px',
            }}>
              {[
                { icon: '✨', text: 'Create a new task', prompt: 'Create a new task for me' },
                { icon: '📋', text: 'Show my tasks', prompt: 'What tasks do I have today?' },
                { icon: '🎯', text: 'What should I focus on?', prompt: 'What should I focus on next?' },
                { icon: '💡', text: 'Help me organize', prompt: 'Help me organize my tasks' },
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputMessage(suggestion.prompt)}
                  style={{
                    padding: '16px 20px',
                    background: 'rgba(255, 255, 255, 0.8)',
                    border: '1px solid rgba(0, 102, 255, 0.15)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 102, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(0, 102, 255, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 102, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
                    e.currentTarget.style.borderColor = 'rgba(0, 102, 255, 0.15)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{suggestion.icon}</span>
                  <span>{suggestion.text}</span>
                </button>
              ))}
            </div>
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
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '14px' }}>{msg.content}</p>
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
        {isLoadingMessage && (
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

            {/* Modern Typing Indicator */}
            <div style={{
              padding: '18px 24px',
              background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
              borderRadius: '20px 20px 20px 4px',
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0066FF 0%, #0052CC 100%)',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: '0s',
                boxShadow: '0 2px 4px rgba(0, 102, 255, 0.3)',
              }} />
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0066FF 0%, #0052CC 100%)',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: '0.2s',
                boxShadow: '0 2px 4px rgba(0, 102, 255, 0.3)',
              }} />
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0066FF 0%, #0052CC 100%)',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: '0.4s',
                boxShadow: '0 2px 4px rgba(0, 102, 255, 0.3)',
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
          disabled={isLoadingMessage}
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
          disabled={!inputMessage.trim() || isLoadingMessage}
          style={{
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '600',
            color: '#fff',
            background: '#0066FF',
            border: 'none',
            borderRadius: '12px',
            cursor: (!inputMessage.trim() || isLoadingMessage) ? 'not-allowed' : 'pointer',
            opacity: (!inputMessage.trim() || isLoadingMessage) ? 0.5 : 1,
            transition: 'all 0.2s',
          }}
        >
          Send
        </button>
      </form>

      {/* Animation Styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(0.95);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }

        @keyframes bounce-dot {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.7;
          }
          40% {
            transform: translateY(-8px);
            opacity: 1;
          }
        }

        @keyframes loading-bar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(250%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  );
}

export default ChatInterface;

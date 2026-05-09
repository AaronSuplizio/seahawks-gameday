import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'

function formatAge(isoString) {
  const s = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function JoinPrompt({ onJoin }) {
  const [nameInput, setNameInput] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = nameInput.trim()
    if (trimmed) onJoin(trimmed)
  }

  return (
    <div className="chat-join">
      <p className="chat-join-title">Parent Chat</p>
      <p className="chat-join-sub">Enter your name to join the sideline chat</p>
      <form className="chat-join-form" onSubmit={handleSubmit}>
        <input
          className="chat-name-input"
          type="text"
          placeholder="Your name"
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          maxLength={30}
          autoFocus
        />
        <button className="btn btn-join" type="submit" disabled={!nameInput.trim()}>
          Join Chat
        </button>
      </form>
    </div>
  )
}

export default function Chat({ name, onChangeName }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const bottomRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) setMessages(data)
        setTimeout(scrollToBottom, 50)
      })

    const channel = supabase
      .channel('chat_messages_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
          setTimeout(scrollToBottom, 50)
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [scrollToBottom])

  async function sendMessage(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')

    const tempId = `temp-${Date.now()}`
    const optimistic = { id: tempId, name, message: text, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, optimistic])
    setTimeout(scrollToBottom, 50)

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ name, message: text })
      .select()
      .single()

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setSendError(`Send failed: ${error.message}`)
    } else if (data) {
      setSendError(null)
      setMessages(prev => prev.map(m => m.id === tempId ? data : m))
    }
    setSending(false)
  }

  async function deleteMessage(id) {
    setMessages(prev => prev.filter(m => m.id !== id))
    await supabase.from('chat_messages').delete().eq('id', id)
  }

  // Only the most recent real (non-temp) message from this user is deletable
  const myLastId = [...messages].reverse().find(m => m.name === name && typeof m.id === 'number')?.id

  return (
    <div className="chat">
      <div className="chat-header">
        <span className="chat-title">Parent Chat</span>
        <button className="chat-change-name" onClick={onChangeName}>
          {name} · change
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">No messages yet — say something! 👋</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`chat-msg ${msg.name === name ? 'chat-msg-mine' : ''}`}>
            <div className="chat-msg-meta">
              <span className="chat-msg-name">{msg.name}</span>
              <span className="chat-msg-time">{formatAge(msg.created_at)}</span>
              {msg.id === myLastId && (
                <button className="chat-delete-btn" onClick={() => deleteMessage(msg.id)} title="Delete message">
                  ✕
                </button>
              )}
            </div>
            <div className="chat-msg-bubble">{msg.message}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {sendError && <div className="chat-error">{sendError}</div>}

      <form className="chat-input-row" onSubmit={sendMessage}>
        <input
          className="chat-input"
          type="text"
          placeholder="Message the sideline..."
          value={input}
          onChange={e => setInput(e.target.value)}
          maxLength={280}
        />
        <button className="btn btn-send" type="submit" disabled={!input.trim() || sending}>
          Send
        </button>
      </form>
    </div>
  )
}

export { JoinPrompt }

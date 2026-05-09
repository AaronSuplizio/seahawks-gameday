import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'

function formatAge(isoString) {
  const s = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1400
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(resolve, 'image/jpeg', 0.84)
    }
    img.src = url
  })
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

export default function Chat({ name, isAdmin, onChangeName }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [pendingImage, setPendingImage] = useState(null) // { file, previewUrl }
  const [expandedImg, setExpandedImg] = useState(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

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

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const previewUrl = URL.createObjectURL(file)
    setPendingImage({ file, previewUrl })
  }

  function clearPendingImage() {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
  }

  async function sendMessage(e) {
    e.preventDefault()
    const text = input.trim()
    if ((!text && !pendingImage) || sending) return

    setSending(true)
    setSendError(null)
    setInput('')

    let imageUrl = null

    if (pendingImage) {
      setUploading(true)
      try {
        const blob = await compressImage(pendingImage.file)
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(fileName, blob, { contentType: 'image/jpeg' })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('chat-images')
          .getPublicUrl(fileName)
        imageUrl = publicUrl
      } catch (err) {
        setSendError(`Upload failed: ${err.message}`)
        setSending(false)
        setUploading(false)
        return
      }
      setUploading(false)
      clearPendingImage()
    }

    const tempId = `temp-${Date.now()}`
    const optimistic = {
      id: tempId,
      name,
      message: text,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(scrollToBottom, 50)

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ name, message: text, image_url: imageUrl })
      .select()
      .single()

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setSendError(`Send failed: ${error.message}`)
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? data : m))
    }
    setSending(false)
  }

  async function deleteMessage(id) {
    setMessages(prev => prev.filter(m => m.id !== id))
    await supabase.from('chat_messages').delete().eq('id', id)
  }

  async function clearAllMessages() {
    setConfirmingClear(false)
    setMessages([])
    await supabase.from('chat_messages').delete().gte('id', 0)
  }

  const [activeMsgId, setActiveMsgId] = useState(null)

  function toggleActive(msgId) {
    setActiveMsgId(prev => prev === msgId ? null : msgId)
  }

  return (
    <div className="chat">
      <div className="chat-header">
        <span className="chat-title">Parent Chat</span>
        <div className="chat-header-right">
          {isAdmin && (
            confirmingClear ? (
              <span className="chat-clear-confirm">
                <span className="chat-clear-confirm-label">Clear all?</span>
                <button className="btn btn-clear-yes" onClick={clearAllMessages}>Yes</button>
                <button className="btn btn-clear-no" onClick={() => setConfirmingClear(false)}>No</button>
              </span>
            ) : (
              <button className="btn btn-clear-chat" onClick={() => setConfirmingClear(true)}>
                Clear Chat
              </button>
            )
          )}
          <button className="chat-change-name" onClick={onChangeName}>
            {name} · change
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">No messages yet — say something! 👋</p>
        )}
        {messages.map(msg => {
          const isMyMsg = msg.name === name && typeof msg.id === 'number'
          const isActive = msg.id === activeMsgId
          return (
            <div
              key={msg.id}
              className={`chat-msg ${isMyMsg ? 'chat-msg-mine' : ''} ${isActive ? 'chat-msg-active' : ''}`}
              onClick={isMyMsg ? () => toggleActive(msg.id) : undefined}
            >
              <div className="chat-msg-meta">
                <span className="chat-msg-name">{msg.name}</span>
                <span className="chat-msg-time">{formatAge(msg.created_at)}</span>
              </div>
              <div className="chat-msg-bubble">
                {msg.image_url && (
                  <img
                    className="chat-msg-image"
                    src={msg.image_url}
                    alt="Shared photo"
                    onClick={e => { e.stopPropagation(); setExpandedImg(msg.image_url) }}
                  />
                )}
                {msg.message && <span className="chat-msg-text">{msg.message}</span>}
              </div>
              {isMyMsg && (
                <button
                  className="chat-delete-btn"
                  onClick={e => { e.stopPropagation(); deleteMessage(msg.id) }}
                >
                  Unsend
                </button>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {sendError && <div className="chat-error">{sendError}</div>}

      {pendingImage && (
        <div className="chat-image-preview">
          <div className="chat-preview-thumb-wrap">
            <img className="chat-preview-thumb" src={pendingImage.previewUrl} alt="Preview" />
            {uploading && <div className="chat-preview-spinner" />}
          </div>
          <span className="chat-preview-label">
            {uploading ? 'Uploading…' : 'Photo ready'}
          </span>
          <button className="chat-preview-remove" onClick={clearPendingImage} disabled={sending}>✕</button>
        </div>
      )}

      <form className="chat-input-row" onSubmit={sendMessage}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="chat-file-input"
          onChange={handleImageSelect}
        />
        <button
          type="button"
          className="btn-photo"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title="Share a photo"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <input
          className="chat-input"
          type="text"
          placeholder={pendingImage ? 'Add a caption…' : 'Message…'}
          value={input}
          onChange={e => setInput(e.target.value)}
          maxLength={280}
        />
        <button
          className="btn btn-send"
          type="submit"
          disabled={(!input.trim() && !pendingImage) || sending}
        >
          {uploading ? '…' : 'Send'}
        </button>
      </form>

      {expandedImg && (
        <div className="chat-img-lightbox" onClick={() => setExpandedImg(null)}>
          <img src={expandedImg} alt="Full size" className="chat-img-lightbox-img" />
        </div>
      )}
    </div>
  )
}

export { JoinPrompt }

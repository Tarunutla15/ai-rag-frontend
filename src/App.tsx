import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  createSession,
  deleteDocument,
  deleteSession,
  documentPdfUrl,
  fetchDocuments,
  fetchSessionDocuments,
  fetchSessions,
  fetchSessionMessages,
  replaceDocument,
  sendChat,
  setSessionDocuments,
  uploadBatch,
} from './api'
import type { ChatMessage, ChatSession, DocumentInfo } from './types'
import { ChatMarkdown } from './ChatMarkdown'

type Mode = 'chat' | 'upload' | 'library'

type UploadedDoc = {
  file_id: string
  file_name: string
  technology?: string
  domain?: string
  /** From library API: UPLOADED / INGESTED / FAILED */
  status?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function App() {
  const [mode, setMode] = useState<Mode>('chat')
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [libraryDocs, setLibraryDocs] = useState<DocumentInfo[]>([])
  const [libraryBusyId, setLibraryBusyId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<
    Array<{ id: number; type: 'success' | 'error' | 'info'; title?: string; text: string }>
  >([])

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  function pushToast(type: 'success' | 'error' | 'info', text: string, title?: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((prev) => [...prev, { id, type, text, title }])
    const ms = type === 'error' ? 5200 : type === 'success' ? 4800 : 4000
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, ms)
  }

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  )

  const availableDocOptions = useMemo(() => {
    const map = new Map<string, UploadedDoc>()
    for (const d of uploadedDocs) map.set(d.file_id, d)
    // ensure selected ids are visible even if we don't have metadata (page refresh)
    for (const id of selectedFileIds) {
      if (!map.has(id)) map.set(id, { file_id: id, file_name: id })
    }
    return Array.from(map.values()).sort((a, b) =>
      a.file_name.localeCompare(b.file_name, undefined, { sensitivity: 'base' }),
    )
  }, [uploadedDocs, selectedFileIds])

  async function refreshSessions(selectId?: string) {
    const list = await fetchSessions()
    setSessions(list)
    if (selectId) setActiveSessionId(selectId)
  }

  async function loadMessages(sessionId: string) {
    const msgs = await fetchSessionMessages(sessionId)
    setMessages(msgs)
  }

  useEffect(() => {
    Promise.all([refreshSessions(), refreshLibrary()]).catch((e) => setError(String(e)))
  }, [])

  async function refreshLibrary() {
    const docs = await fetchDocuments()
    setLibraryDocs(docs)
    // also merge into uploadedDocs so scope UI can show them
    setUploadedDocs((prev) => {
      const merged = new Map<string, UploadedDoc>()
      for (const d of prev) merged.set(d.file_id, d)
      for (const d of docs) {
        if (!d.document_id) continue
        merged.set(d.document_id, {
          file_id: d.document_id,
          file_name: d.file_name,
          technology: d.technology ?? undefined,
          domain: d.domain ?? undefined,
          status: d.status ?? undefined,
        })
      }
      return Array.from(merged.values())
    })
  }

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      return
    }
    loadMessages(activeSessionId).catch((e) => setError(String(e)))
  }, [activeSessionId])

  // When switching sessions, load its document scope (server-side persisted).
  // Important: after the first message the backend creates a session_id — if we never
  // PUT session documents, fetch returns [] and would wipe local checkbox state unless
  // onSend persists scope first (see onSend).
  useEffect(() => {
    if (!activeSessionId) {
      setSelectedFileIds([])
      return
    }
    fetchSessionDocuments(activeSessionId)
      .then((ids) => setSelectedFileIds(ids))
      .catch((e) => setError(String(e)))
  }, [activeSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function onNewChat() {
    setError(null)
    setBusy(true)
    try {
      const s = await createSession()
      await refreshSessions(s.id)
      await loadMessages(s.id)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onDeleteChat(id: string) {
    setError(null)
    setBusy(true)
    try {
      await deleteSession(id)
      const next = activeSessionId === id ? null : activeSessionId
      await refreshSessions()
      setActiveSessionId(next)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onSend() {
    const q = prompt.trim()
    if (!q) return

    setPrompt('')
    setError(null)

    const userMsg: ChatMessage = {
      id: Date.now(),
      session_id: activeSessionId ?? '',
      role: 'user',
      content: q,
      created_at: new Date().toISOString(),
    }
    setMessages((m) => [...m, userMsg])

    setBusy(true)
    try {
      const res = await sendChat({
        query: q,
        session_id: activeSessionId ?? undefined,
        ...(selectedFileIds.length > 0 ? { file_ids: selectedFileIds } : {}),
      })
      const resolvedSessionId = res.session_id ?? activeSessionId ?? null
      // Persist scope to Supabase BEFORE setActiveSessionId so the session_documents
      // effect does not fetch [] and clear selectedFileIds on the 2nd message.
      if (resolvedSessionId && selectedFileIds.length > 0) {
        await setSessionDocuments(resolvedSessionId, { file_ids: selectedFileIds })
      }
      if (!activeSessionId && res.session_id) {
        setActiveSessionId(res.session_id)
        await refreshSessions(res.session_id)
      } else {
        await refreshSessions()
      }
      const assistantMsg: ChatMessage = {
        id: Date.now() + 1,
        session_id: res.session_id,
        role: 'assistant',
        content: res.answer,
        created_at: new Date().toISOString(),
      }
      setMessages((m) => [...m, assistantMsg])
    } catch (e) {
      const msg = String(e)
      setError(msg)
      pushToast('error', msg)
    } finally {
      setBusy(false)
    }
  }

  async function onUpload() {
    if (files.length === 0) return
    setError(null)
    setBusy(true)
    try {
      const res = await uploadBatch(files)
      // Track uploaded docs locally so user can select them as scope.
      // Backend uses the returned file_id as document_id.
      const nextDocs: UploadedDoc[] = []
      for (const r of res.results ?? []) {
        if (r.file_id && (r.status === 'success' || r.status === 'duplicate')) {
          nextDocs.push({
            file_id: r.file_id,
            file_name: r.file_name,
            technology: r.technology,
            domain: r.domain,
          })
        }
      }
      if (nextDocs.length) {
        setUploadedDocs((prev) => {
          const merged = new Map<string, UploadedDoc>()
          for (const d of prev) merged.set(d.file_id, d)
          for (const d of nextDocs) merged.set(d.file_id, d)
          return Array.from(merged.values())
        })
      }
      // Load library from server before leaving upload so the sidebar lists every PDF.
      await refreshLibrary().catch(() => {})
      await refreshSessions()
      setMode('chat')
      const results = res.results ?? []
      const nOk = results.filter((r) => r.status === 'success').length
      const nDup = results.filter((r) => r.status === 'duplicate').length
      const nErr = results.filter((r) => r.status === 'error').length
      const parts: string[] = []
      if (nOk) parts.push(`${nOk} added to library`)
      if (nDup) parts.push(`${nDup} already in library`)
      if (nErr) parts.push(`${nErr} failed`)
      const detail = parts.length ? parts.join(' · ') : res.message
      pushToast('success', detail, 'Upload complete')
      setFiles([])
    } catch (e) {
      const msg = String(e)
      setError(msg)
      pushToast('error', msg)
    } finally {
      setBusy(false)
    }
  }

  async function onToggleDoc(fileId: string, checked: boolean) {
    setError(null)
    const next = checked ? Array.from(new Set([...selectedFileIds, fileId])) : selectedFileIds.filter((x) => x !== fileId)
    setSelectedFileIds(next)
    if (activeSessionId) {
      try {
        await setSessionDocuments(activeSessionId, { file_ids: next })
      } catch (e) {
        setError(String(e))
      }
    }
  }

  async function persistSessionScope(ids: string[]) {
    if (!activeSessionId) return
    try {
      await setSessionDocuments(activeSessionId, { file_ids: ids })
    } catch (e) {
      setError(String(e))
    }
  }

  async function onSelectAllDocs() {
    setError(null)
    const ids = availableDocOptions.map((d) => d.file_id)
    setSelectedFileIds(ids)
    await persistSessionScope(ids)
  }

  async function onClearDocSelection() {
    setError(null)
    setSelectedFileIds([])
    await persistSessionScope([])
  }

  async function onDeleteLibraryDocument(documentId: string) {
    if (!window.confirm('Delete this PDF and all its data (Supabase, Zilliz, local files)? This cannot be undone.')) {
      return
    }
    setError(null)
    setLibraryBusyId(documentId)
    try {
      const out = await deleteDocument(documentId)
      if (out.errors?.length) {
        setError(`Deleted with warnings: ${out.errors.join('; ')}`)
      }
      setLibraryDocs((prev) => prev.filter((d) => d.document_id !== documentId))
      setUploadedDocs((prev) => prev.filter((d) => d.file_id !== documentId))
      const nextScope = selectedFileIds.filter((id) => id !== documentId)
      setSelectedFileIds(nextScope)
      if (activeSessionId) {
        try {
          await setSessionDocuments(activeSessionId, { file_ids: nextScope })
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLibraryBusyId(null)
    }
  }

  return (
    <div className="app">
      {toasts.length ? (
        <div className="toastHost" aria-live="polite" aria-relevant="additions">
          {toasts.map((t) => (
            <div key={t.id} className={'toast toast-' + t.type} role="status">
              <div className="toastIcon" aria-hidden>
                {t.type === 'success' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : t.type === 'error' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <div className="toastBody">
                {t.title ? <div className="toastTitle">{t.title}</div> : null}
                <div className="toastText">{t.text}</div>
              </div>
              <button
                type="button"
                className="toastClose"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <aside className="sidebar">
        <div className="sidebarHeader">
          <div className="brand">
            <div className="title">PDF Chatbot</div>
            <p className="tagline">Ask questions scoped to your library</p>
          </div>
          <div className="modes" role="tablist" aria-label="Main sections">
            <button
              className={mode === 'chat' ? 'active' : ''}
              onClick={() => setMode('chat')}
              type="button"
            >
              Chat
            </button>
            <button
              className={mode === 'upload' ? 'active' : ''}
              onClick={() => setMode('upload')}
              type="button"
            >
              Upload
            </button>
            <button
              className={mode === 'library' ? 'active' : ''}
              onClick={() => {
                setMode('library')
                refreshLibrary().catch((e) => setError(String(e)))
              }}
              type="button"
            >
              Library
            </button>
          </div>
        </div>

        <div className="sidebarActions">
          <button className="btnPrimary" onClick={onNewChat} disabled={busy} type="button">
            New chat
          </button>
        </div>

        <section className="docScope" aria-labelledby="pdfs-heading">
          <div className="docScopeHead">
            <h2 id="pdfs-heading" className="docScopeTitle">
              Library
              {availableDocOptions.length > 0 ? (
                <span className="docScopeCount">{availableDocOptions.length}</span>
              ) : null}
            </h2>
            <button
              type="button"
              className="docScopeRefresh"
              title="Reload PDF list"
              disabled={busy}
              onClick={() => refreshLibrary().catch((e) => setError(String(e)))}
            >
              ↻
            </button>
          </div>
          {availableDocOptions.length > 0 ? (
            <details className="docScopeHint">
              <summary>Scope & filtering</summary>
              <p>
                Leave all unchecked to search <strong>every ingested</strong> PDF. Tick files to limit answers to those
                documents only.
              </p>
            </details>
          ) : (
            <p className="docScopeLead muted">Add PDFs via Upload or Library. Retrieval uses all ingested files until you filter.</p>
          )}
          {availableDocOptions.length === 0 ? null : (
            <>
              <div className="docScopeToolbar">
                <button type="button" className="miniBtn" disabled={busy} onClick={() => void onSelectAllDocs()}>
                  All
                </button>
                <button type="button" className="miniBtn" disabled={busy} onClick={() => void onClearDocSelection()}>
                  None
                </button>
              </div>
              <div className="docList">
                {availableDocOptions.map((d) => (
                  <label
                    key={d.file_id}
                    className={'docCard' + (selectedFileIds.includes(d.file_id) ? ' docCardChecked' : '')}
                  >
                    <input
                      className="docCardCb"
                      type="checkbox"
                      checked={selectedFileIds.includes(d.file_id)}
                      onChange={(e) => onToggleDoc(d.file_id, e.target.checked)}
                      disabled={busy}
                    />
                    <div className="docCardBody">
                      <span className="docName" title={d.file_name}>
                        {d.file_name}
                      </span>
                      <div className="docCardBadges">
                        {d.status ? (
                          <span
                            className={
                              'docBadge' + (String(d.status).toUpperCase() === 'INGESTED' ? ' docBadgeOk' : '')
                            }
                          >
                            {d.status}
                          </span>
                        ) : null}
                        {d.technology ? <span className="docBadge docBadgeTech">{d.technology}</span> : null}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="chatsSection" aria-labelledby="chats-heading">
          <h2 id="chats-heading" className="chatsHeading">
            Chats
          </h2>
          <div className="sessions">
            {sessions.length === 0 ? (
              <div className="chatsEmpty muted">No conversations yet — start with New chat.</div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className={'session' + (s.id === activeSessionId ? ' selected' : '')}
                  onClick={() => setActiveSessionId(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setActiveSessionId(s.id)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="sessionMain">
                    <div className="sessionTitle" title={s.title}>
                      {s.title}
                    </div>
                    <div className="sessionMeta">
                      <span className="sessionDot" aria-hidden />
                      <span>{s.message_count ?? 0} messages</span>
                    </div>
                  </div>
                  <button
                    className="sessionRemove"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteChat(s.id)
                    }}
                    disabled={busy}
                    type="button"
                    title="Remove chat"
                    aria-label="Remove chat"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="topbarTitle">
            {mode === 'upload' ? 'Upload PDFs' : mode === 'library' ? 'PDF Library' : activeSession?.title ?? 'Chat'}
          </div>
          <div className="topbarRight">
            <span className="pill">API: / (proxied to :8000)</span>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}

        {mode === 'upload' ? (
          <div className="uploadPage">
            <section className="uploadCard" aria-labelledby="upload-heading">
              <div className="uploadCardHeader">
                <div className="uploadCardIcon" aria-hidden>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65">
                    <path d="M12 4v12M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="uploadCardTitles">
                  <h2 id="upload-heading" className="uploadCardTitle">
                    Add PDFs to your library
                  </h2>
                  <p className="uploadCardDesc">
                    Text is extracted, chunked, and indexed for search and chat. Duplicate files are merged automatically.
                  </p>
                </div>
              </div>

              <label
                className={'uploadDropzone' + (busy ? ' uploadDropzoneDisabled' : '')}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const picked = Array.from(e.dataTransfer.files).filter(
                    (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
                  )
                  if (picked.length) setFiles(picked)
                }}
              >
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="uploadInputHidden"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  disabled={busy}
                />
                <div className="uploadDropzoneInner">
                  <span className="uploadDropHint">Drop PDFs here or click to browse</span>
                  <span className="uploadDropSub">Multiple files · max practical size depends on your API limits</span>
                </div>
              </label>

              {files.length > 0 ? (
                <ul className="uploadFileList">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${f.size}-${i}`} className="uploadFileRow">
                      <span className="uploadFileName" title={f.name}>
                        {f.name}
                      </span>
                      <span className="uploadFileMeta">{formatFileSize(f.size)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="uploadActions">
                <button
                  type="button"
                  className="btnPrimary uploadSubmitBtn"
                  onClick={onUpload}
                  disabled={busy || files.length === 0}
                >
                  {busy ? (
                    <>
                      <span className="spinner" aria-hidden />
                      Processing…
                    </>
                  ) : (
                    'Upload & process'
                  )}
                </button>
                {files.length > 0 ? (
                  <button type="button" className="btnGhost" onClick={() => setFiles([])} disabled={busy}>
                    Clear selection
                  </button>
                ) : null}
              </div>
            </section>
          </div>
        ) : mode === 'library' ? (
          <section className="panel">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="muted">{libraryDocs.length ? `${libraryDocs.length} document(s)` : 'No documents yet.'}</div>
              <button
                onClick={() => refreshLibrary().catch((e) => setError(String(e)))}
                disabled={busy}
                type="button"
              >
                Refresh
              </button>
            </div>
            <div className="libraryList">
              {libraryDocs.map((d) => (
                <div key={d.document_id} className="libraryItem">
                  <div className="libraryMain">
                    <div className="libraryTitle" title={d.file_name}>
                      {d.file_name}
                    </div>
                    <div className="libraryMeta">
                      <span className="muted">id: {d.document_id}</span>
                      {d.status ? <span className="docBadge">{d.status}</span> : null}
                      {d.technology ? <span className="docBadge">{d.technology}</span> : null}
                      {typeof d.chunk_count === 'number' ? <span className="muted">{d.chunk_count} chunks</span> : null}
                    </div>
                  </div>
                  <div className="libraryActions">
                    <a className="linkBtn" href={documentPdfUrl(d.document_id)} target="_blank" rel="noreferrer">
                      View PDF
                    </a>
                    <button
                      className="linkBtn danger"
                      type="button"
                      disabled={busy || libraryBusyId === d.document_id}
                      onClick={() => onDeleteLibraryDocument(d.document_id)}
                    >
                      {libraryBusyId === d.document_id ? '…' : 'Delete'}
                    </button>
                    <label className="linkBtn">
                      {libraryBusyId === d.document_id ? 'Replacing…' : 'Replace PDF'}
                      <input
                        type="file"
                        accept="application/pdf"
                        disabled={busy || libraryBusyId === d.document_id}
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          setError(null)
                          setLibraryBusyId(d.document_id)
                          try {
                            await replaceDocument(d.document_id, f)
                            await refreshLibrary()
                            pushToast('success', 'Library and search index were refreshed.', 'PDF replaced')
                          } catch (err) {
                            const msg = String(err)
                            setError(msg)
                            pushToast('error', msg)
                          } finally {
                            setLibraryBusyId(null)
                            e.target.value = ''
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="chat">
              {messages.length === 0 ? (
                <div className="muted chatHint">
                  Start a chat and ask a question. Optional: use <strong>Your PDFs</strong> in the sidebar to narrow which
                  files are searched.
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={'msg ' + (m.role === 'user' ? 'user' : 'assistant')}>
                    <div className="role">{m.role}</div>
                    <div
                      className={
                        'bubble' + (m.role === 'assistant' ? ' bubbleMd' : ' bubblePlain')
                      }
                    >
                      {m.role === 'assistant' ? (
                        <ChatMarkdown content={m.content} />
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                ))
              )}
              {busy ? (
                <div className="msg assistant">
                  <div className="role">assistant</div>
                  <div className="bubble bubbleMd thinking">
                    <div className="thinkingRow">
                      <span className="spinner" aria-hidden />
                      <span>Thinking…</span>
                    </div>
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </section>

            <section className="composer">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask about your documents…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) onSend()
                }}
                disabled={busy}
              />
              <button onClick={onSend} disabled={busy || !prompt.trim()} type="button">
                {busy ? '…' : 'Send'}
              </button>
              <div className="composerMeta">
                <span className="muted">
                  Session: <code>{activeSessionId ?? '—'}</code>
                </span>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

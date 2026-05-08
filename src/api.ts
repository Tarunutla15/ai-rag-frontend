import type {
  BatchUploadResponse,
  ChatRequest,
  ChatResponse,
  ChatSession,
  DocumentInfo,
  SessionDocumentsRequest,
  SessionMessagesResponse,
} from './types'

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as any
    return data?.detail ? String(data.detail) : JSON.stringify(data)
  } catch {
    return await res.text()
  }
}

export async function fetchSessions(): Promise<ChatSession[]> {
  const res = await fetch('/sessions/', { method: 'GET' })
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as ChatSession[]
}

export async function createSession(title?: string): Promise<ChatSession> {
  const res = await fetch('/sessions/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(title ? { title } : null),
  })
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as ChatSession
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await readError(res))
}

export async function fetchSessionMessages(sessionId: string) {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/messages`, { method: 'GET' })
  if (!res.ok) throw new Error(await readError(res))
  const data = (await res.json()) as SessionMessagesResponse
  return data.messages
}

export async function fetchSessionDocuments(sessionId: string): Promise<string[]> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/documents`, { method: 'GET' })
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as string[]
}

export async function setSessionDocuments(sessionId: string, payload: SessionDocumentsRequest): Promise<string[]> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/documents`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as string[]
}

export async function sendChat(payload: ChatRequest): Promise<ChatResponse> {
  const res = await fetch('/chat/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as ChatResponse
}

export async function uploadBatch(files: File[]): Promise<BatchUploadResponse> {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  const res = await fetch('/upload/batch', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as BatchUploadResponse
}

export async function fetchDocuments(): Promise<DocumentInfo[]> {
  const res = await fetch('/documents/', { method: 'GET' })
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as DocumentInfo[]
}

export function documentPdfUrl(documentId: string): string {
  return `/documents/${encodeURIComponent(documentId)}/pdf`
}

export async function replaceDocument(documentId: string, file: File): Promise<any> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/documents/${encodeURIComponent(documentId)}/replace`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await readError(res))
  return await res.json()
}

export async function deleteDocument(documentId: string): Promise<{
  deleted: boolean
  document_id: string
  errors?: string[]
}> {
  const res = await fetch(`/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as {
    deleted: boolean
    document_id: string
    errors?: string[]
  }
}


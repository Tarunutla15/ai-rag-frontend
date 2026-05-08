export type ChatSession = {
  id: string
  title: string
  created_at: string
  last_message_at: string
  message_count?: number
}

export type ChatMessage = {
  id: number
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type SessionMessagesResponse = {
  session_id: string
  messages: ChatMessage[]
  total_count: number
}

export type ChatRequest = {
  query: string
  session_id?: string
  file_id?: string
  file_ids?: string[]
}

export type ChatResponse = {
  answer: string
  session_id: string
  sources?: string[] | null
  detected_technology?: string | null
  detected_domain?: string | null
}

export type BatchUploadResponse = {
  message: string
  total_files: number
  successful: number
  failed: number
  results: Array<{
    file_name: string
    file_id?: string | null
    chunks_created: number
    technology: string
    domain: string
    status: string
    message: string
  }>
}

export type SessionDocumentsRequest = {
  file_ids: string[]
}

export type DocumentInfo = {
  document_id: string
  file_name: string
  status?: string | null
  chunk_count?: number | null
  technology?: string | null
  domain?: string | null
  created_at?: string | null
  updated_at?: string | null
  pdf_path?: string | null
}


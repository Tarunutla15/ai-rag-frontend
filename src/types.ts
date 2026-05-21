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
  figures?: ChatFigure[] | null
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

export type ChatFigure = {
  image_id?: string | null
  document_id?: string | null
  view_url: string
  caption?: string | null
  page_number?: number | null
}

export type ChatResponse = {
  answer: string
  session_id: string
  sources?: string[] | null
  detected_technology?: string | null
  detected_domain?: string | null
  figures?: ChatFigure[] | null
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

export type UsageSummary = {
  chat_completions: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost_usd?: number | null
}

export type UsageEventItem = {
  id?: number | null
  session_id?: string | null
  query_preview: string
  prompt_tokens?: number | null
  completion_tokens?: number | null
  total_tokens?: number | null
  model?: string | null
  provider?: string | null
  cost_usd?: number | null
  created_at: string
}

export type DashboardUsageResponse = {
  days: number
  summary: UsageSummary
  recent: UsageEventItem[]
}


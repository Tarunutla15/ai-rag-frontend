import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { absolutizeMarkdownApiPaths } from './api'

type Props = {
  content: string
}

/** Collapse excessive blank lines from LLM output before Markdown render. */
export function normalizeAssistantMarkdown(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const DOC_IMAGE_MD_RE =
  /!\[[^\]]*\]\([^)]*\/documents\/[^)]+\/images\/(?:page\/\d+|[^)/\s]+)\)/gi

/** Drop duplicate figure embeds when the client renders structured ``figures`` below the text. */
export function stripDocumentFiguresFromMarkdown(content: string): string {
  let s = content.replace(DOC_IMAGE_MD_RE, '')
  s = s.replace(/\n+## Diagrams? from your document\s*\n*/gi, '\n\n')
  s = s.replace(/\n+#{1,3}\s*Figure[^\n]*\n+(?=\n|$)/gi, '\n')
  return normalizeAssistantMarkdown(s)
}

/**
 * Renders assistant messages: headings, lists, bold, tables (GFM), code blocks.
 * Embeds ![...](/documents/.../images/...) using the API base when VITE_API_BASE_URL is set.
 */
export function ChatMarkdown({ content }: Props) {
  const md = absolutizeMarkdownApiPaths(normalizeAssistantMarkdown(content))
  return (
    <div className="mdRoot">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
    </div>
  )
}

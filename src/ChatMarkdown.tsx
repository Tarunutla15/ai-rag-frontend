import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { absolutizeMarkdownApiPaths } from './api'

type Props = {
  content: string
}

/**
 * Renders assistant messages: headings, lists, bold, tables (GFM), code blocks.
 * Embeds ![...](/documents/.../images/...) using the API base when VITE_API_BASE_URL is set.
 */
export function ChatMarkdown({ content }: Props) {
  const md = absolutizeMarkdownApiPaths(content)
  return (
    <div className="mdRoot">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
    </div>
  )
}

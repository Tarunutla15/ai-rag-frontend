import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = {
  content: string
}

/**
 * Renders assistant messages: headings, lists, bold, tables (GFM), code blocks.
 */
export function ChatMarkdown({ content }: Props) {
  return (
    <div className="mdRoot">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

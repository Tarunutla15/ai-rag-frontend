import type { ChatFigure } from './types'
import { apiUrl } from './api'

type Props = {
  figures: ChatFigure[]
}

/** Renders cropped PDF figures from the RAG backend (in addition to Markdown embeds). */
export function ChatFigures({ figures }: Props) {
  if (!figures?.length) return null
  return (
    <div className="chatFigures" role="group" aria-label="Figures from document">
      {figures.map((fig) => {
        const src = apiUrl(fig.view_url)
        const alt = (fig.caption || 'Figure from document').slice(0, 200)
        return (
          <figure key={fig.image_id ?? fig.view_url} className="chatFigure">
            <img src={src} alt={alt} loading="lazy" />
            {fig.page_number != null && fig.page_number > 0 ? (
              <figcaption className="muted">Page {fig.page_number}</figcaption>
            ) : null}
          </figure>
        )
      })}
    </div>
  )
}

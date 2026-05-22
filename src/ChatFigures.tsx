import type { ChatFigure } from './types'
import { apiUrl } from './api'

type Props = {
  figures: ChatFigure[]
}

function figureLabel(fig: ChatFigure): string {
  const cap = (fig.caption || '').trim()
  if (cap && !/^figure on page/i.test(cap)) {
    return cap.length > 160 ? `${cap.slice(0, 157)}…` : cap
  }
  if (fig.page_number != null && fig.page_number > 0) {
    return `Figure (PDF page ${fig.page_number})`
  }
  return 'Figure from document'
}

/** Structured gallery for PDF figures (paired side-by-side when there are two). */
export function ChatFigures({ figures }: Props) {
  if (!figures?.length) return null

  const isPair = figures.length >= 2
  const layoutClass = isPair ? 'chatFigures--pair' : 'chatFigures--single'

  return (
    <section
      className={`chatFigures ${layoutClass}`}
      role="group"
      aria-label="Figures from document"
    >
      <header className="chatFiguresHeader">
        <span className="chatFiguresTitle">
          {figures.length > 1 ? 'Diagrams from your document' : 'Diagram from your document'}
        </span>
      </header>
      <div className="chatFiguresGrid">
        {figures.map((fig, index) => {
          const src = apiUrl(fig.view_url)
          const label = figureLabel(fig)
          const key = fig.image_id ?? fig.view_url ?? String(index)
          return (
            <figure key={key} className="chatFigureCard">
              <div className="chatFigureFrame">
                <img src={src} alt={label} loading="lazy" decoding="async" />
              </div>
              <figcaption className="chatFigureCaption">{label}</figcaption>
            </figure>
          )
        })}
      </div>
    </section>
  )
}

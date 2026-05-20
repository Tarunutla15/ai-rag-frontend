import { useCallback, useEffect, useState } from 'react'
import { fetchDashboardUsage } from './api'
import type { DashboardUsageResponse } from './types'

type Props = {
  onError: (msg: string) => void
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString()
}

function fmtCost(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

export function Dashboard({ onError }: Props) {
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardUsageResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchDashboardUsage({ days, limit: 150 })
      setData(res)
    } catch (e) {
      onError(String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days, onError])

  useEffect(() => {
    void load()
  }, [load])

  const s = data?.summary

  return (
    <div className="dashboard">
      <div className="dashboardHeader">
        <div>
          <h2 className="dashboardTitle">Usage & tokens</h2>
          <p className="dashboardLead muted">
            Chat completion tokens (main answer LLM). Cost uses API env rates: OpenAI{' '}
            <code>OPENAI_*_USD_PER_1M</code>, Groq <code>GROQ_*_USD_PER_1M</code> (defaults apply for Groq).
          </p>
        </div>
        <div className="dashboardToolbar">
          <label className="dashboardDays">
            Window
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <button type="button" className="btnSm" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="dashboardLoading muted">Loading usage…</div>
      ) : !data ? (
        <div className="dashboardEmpty muted">No data.</div>
      ) : (
        <>
          <div className="dashboardCards">
            <div className="dashCard">
              <div className="dashCardLabel">Chat answers</div>
              <div className="dashCardValue">{fmtNum(s?.chat_completions)}</div>
              <div className="dashCardHint">Completions in window</div>
            </div>
            <div className="dashCard">
              <div className="dashCardLabel">Prompt tokens</div>
              <div className="dashCardValue">{fmtNum(s?.prompt_tokens)}</div>
            </div>
            <div className="dashCard">
              <div className="dashCardLabel">Completion tokens</div>
              <div className="dashCardValue">{fmtNum(s?.completion_tokens)}</div>
            </div>
            <div className="dashCard dashCardHighlight">
              <div className="dashCardLabel">Total tokens</div>
              <div className="dashCardValue">{fmtNum(s?.total_tokens)}</div>
            </div>
            <div className="dashCard">
              <div className="dashCardLabel">Est. cost (LLM)</div>
              <div className="dashCardValue">{fmtCost(s?.estimated_cost_usd ?? null)}</div>
              <div className="dashCardHint">From stored per-turn estimates</div>
            </div>
          </div>

          <div className="dashboardTableWrap">
            <h3 className="dashboardTableTitle">Recent queries</h3>
            {data.recent.length === 0 ? (
              <p className="muted">No chat completions recorded yet. Ask a question in Chat — tokens appear after each answer.</p>
            ) : (
              <div className="tableScroll">
                <table className="usageTable">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>In</th>
                      <th>Out</th>
                      <th>Total</th>
                      <th>Model</th>
                      <th>Cost</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((row) => (
                      <tr key={`${row.id ?? row.created_at}-${row.session_id}`}>
                        <td className="usageQuery" title={row.query_preview}>
                          {row.query_preview || '(empty)'}
                        </td>
                        <td>{fmtNum(row.prompt_tokens ?? undefined)}</td>
                        <td>{fmtNum(row.completion_tokens ?? undefined)}</td>
                        <td>
                          <strong>{fmtNum(row.total_tokens ?? undefined)}</strong>
                        </td>
                        <td className="muted nowrap">
                          {row.provider}/{row.model ?? '—'}
                        </td>
                        <td>{fmtCost(row.cost_usd ?? null)}</td>
                        <td className="muted nowrap">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

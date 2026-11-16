// lib/api/chatbot.ts  (admin panel)
import api from '../axios'

export interface UnmatchedQuery {
  query: string            // normalised message (groups spelling variants)
  example: string          // as a customer typed it (last time)
  count: number
  dialect: string | null   // fr | en | tn_arabizi | tn_arabic | msa
  min_results: number
  max_results: number      // products the bot finally showed (0 = nothing at all)
  understood: { concept?: string; gender?: string; keywords?: string[]; relaxed?: string[] }
  first_seen: string
  last_seen: string
}

export const adminChatbotApi = {
  unmatched: (params: { days?: number; zero_only?: boolean; limit?: number }) =>
    api.get<{ data: UnmatchedQuery[]; lexicon_file: string }>('/admin/chatbot/unmatched', {
      params: { ...params, zero_only: params.zero_only ? 1 : undefined },
    }).then(r => r.data),

  /** "Handled": forget every row of this message */
  resolve: (query: string) => api.delete('/admin/chatbot/unmatched', { data: { query } }),
}

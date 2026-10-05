// lib/api/search.ts  (admin panel)
import api from '../axios'

export interface MissedQuery {
  query: string          // normalized (lowercase, no accents, Arabic letters unified)
  example: string | null // as a customer typed it
  searches: number
  min_results: number
  max_results: number
  first_seen: string
  last_seen: string
}

export interface MissedQueriesResponse {
  data: MissedQuery[]
  low_results: number
  synonyms_file: string
}

export interface SearchHealth {
  ai_service: boolean          // choosetounsi-ai-service answers /health
  photos_indexed: number       // searchable photo fingerprints (live products, active sellers)
  categories: number           // categories with a centroid (category detection)
  image_model: string | null   // model the AI service runs now
  index_model: string | null   // model the fingerprints were made with
}

export const adminSearchApi = {
  missed: (params: { days?: number; zero_only?: boolean; limit?: number }) =>
    api.get<MissedQueriesResponse>('/admin/search/missed', {
      params: { ...params, zero_only: params.zero_only ? 1 : undefined },
    }).then(r => r.data),

  health: () => api.get<SearchHealth>('/admin/search/health').then(r => r.data),
}

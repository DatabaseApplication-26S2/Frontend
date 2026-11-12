// API 기준 URL. VITE_API_BASE_URL(기본 '/api/v1')을 현재 출처 기준의 절대 URL로 바꾼다.
// 절대 URL이어야 Vitest(Node)의 Request가 받는다. 브라우저에서는 상대 값과 같다.
// 끝 슬래시는 없다: openapi-fetch가 `${baseUrl}${path}`로 이어 붙인다.
const configured: string | undefined = import.meta.env.VITE_API_BASE_URL
const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'

export const API_BASE_URL: string = new URL(configured || '/api/v1', origin).href.replace(/\/+$/, '')

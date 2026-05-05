import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async () => ({
  locale: 'he',
  messages: (await import('./he.json')).default,
}))

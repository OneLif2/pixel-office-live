export type PixelOfficeWeather = 'clear' | 'storm' | 'sunny' | 'night'

export const WEATHER_STORAGE_KEY = 'pixel-office-weather'
export const WEATHER_CONFIG_EVENT = 'openclaw-weather-config-change'

export const WEATHER_OPTIONS: Array<{ value: PixelOfficeWeather; labelKey: string }> = [
  { value: 'clear', labelKey: 'nav.weather.clear' },
  { value: 'storm', labelKey: 'nav.weather.storm' },
  { value: 'sunny', labelKey: 'nav.weather.sunny' },
  { value: 'night', labelKey: 'nav.weather.night' },
]

export function normalizeWeather(value: unknown): PixelOfficeWeather {
  return value === 'storm' || value === 'sunny' || value === 'night' ? value : 'clear'
}

export function getStoredWeather(): PixelOfficeWeather {
  if (typeof window === 'undefined') return 'clear'
  return normalizeWeather(window.localStorage.getItem(WEATHER_STORAGE_KEY))
}

export function setStoredWeather(weather: PixelOfficeWeather): void {
  window.localStorage.setItem(WEATHER_STORAGE_KEY, weather)
  window.dispatchEvent(new CustomEvent(WEATHER_CONFIG_EVENT, { detail: { weather } }))
}

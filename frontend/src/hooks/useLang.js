import { useLangStore } from '../store'
import tr from '../locales/tr'
import ar from '../locales/ar'
import en from '../locales/en'

const T = { tr, ar, en }

export function useLang() {
  const { lang, setLang } = useLangStore()
  const t = T[lang] || T.tr
  return { lang, setLang, t, dir: t.dir }
}

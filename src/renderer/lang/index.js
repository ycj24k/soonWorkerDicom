import Vue from 'vue'
import VueI18n from 'vue-i18n'
import Cookies from 'js-cookie'
import elementEnLocale from 'element-ui/lib/locale/lang/en' // element-ui lang
import elementZhCNLocale from 'element-ui/lib/locale/lang/zh-CN'// element-ui lang
import elementZhTWLocale from 'element-ui/lib/locale/lang/zh-TW'// element-ui lang
import enLocale from './en'
import zhCNLocale from './zh-CN'
import zhTWLocale from './zh-TW'

Vue.use(VueI18n)

const messages = {
  en: {
    ...enLocale,
    ...elementEnLocale
  },
  zhCN: {
    ...zhCNLocale,
    ...elementZhCNLocale
  },
  zhTW: {
    ...zhTWLocale,
    ...elementZhTWLocale
  }
}
export function getLanguage() {
  const chooseLanguage = Cookies.get('language')
  if (chooseLanguage) return chooseLanguage

  // if has not choose language
  // const language = (navigator.language || navigator.browserLanguage).toLowerCase()
  // const locales = Object.keys(messages)
  // for (const locale of locales) {
  //   if (language.indexOf(locale) > -1) {
  //     return locale
  //   }
  // }
  return 'zhCN'
}
const i18n = new VueI18n({
  // set locale
  // options: en | zhCN | zhTW
  locale: getLanguage(),
  // set locale messages
  messages
})

export default i18n

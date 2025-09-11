import Cookies from 'js-cookie'
import { getLanguage } from '../../lang/index'

const state = {
  device: 'desktop',
  language: getLanguage(),
  size: Cookies.get('size') || 'medium',
  // 影像文件地址 
  directory: Cookies.get('directory') || '/media/cardsoon/DICOM/'
}

const mutations = {
  setData: (state, data) => {
    state[data.key] = data.value
    if (data.isSave) {
      Cookies.set(data.key, data.value)
    }
  }
}

const actions = {
  toggleDevice({ commit }, device) {
    commit('setData', {key: 'device', value: device, isSave: false})
  },
  setLanguage({ commit }, language) {
    commit('setData', {key: 'language', value: language, isSave: true})
  },
  setSize({ commit }, size) {
    commit('setData', {key: 'size', value: size, isSave: true})
  },
  setDirectory({ commit }, directory) {
    commit('setData', {key: 'directory', value: directory, isSave: true})
  }
}

export default {
  state,
  mutations,
  actions
}

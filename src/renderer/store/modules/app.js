import Cookies from 'js-cookie'
import { getLanguage } from '../../lang/index'

const state = {
  device: 'desktop',
  language: getLanguage(),
  size: Cookies.get('size') || 'medium',
  // 影像文件地址 
  directory: Cookies.get('directory') || '/media/cardsoon/DICOM/',
  isVerified: false
}

const mutations = {
  setData: (state, data) => {
    state[data.key] = data.value
    if (data.isSave) {
      Cookies.set(data.key, data.value)
    }
  },
  SET_VERIFIED: (state, status) => {
    state.isVerified = status
  }
}

const actions = {
  toggleDevice({ commit }, device) {
    commit('setData', { key: 'device', value: device, isSave: false })
  },
  setLanguage({ commit }, language) {
    commit('setData', { key: 'language', value: language, isSave: true })
  },
  setSize({ commit }, size) {
    commit('setData', { key: 'size', value: size, isSave: true })
  },
  setDirectory({ commit }, directory) {
    commit('setData', { key: 'directory', value: directory, isSave: true })
  },
  async verifyLicense({ commit }) {
    try {
      const DogLockService = require('../../services/DogLockService').default;
      console.log('App Store: verifyLicense called');
      const { verified } = await DogLockService.checkLicense();
      console.log('App Store: verification result:', verified);
      commit('SET_VERIFIED', verified);
      return verified;
    } catch (e) {
      console.error('App Store: License verification failed with error:', e);
      commit('SET_VERIFIED', false);
      return false;
    }
  }
}

export default {
  state,
  mutations,
  actions
}

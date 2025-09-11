// import { login, logout, getInfo } from '@/api/login'
import { getToken, setToken, removeToken } from '../../utils/auth'
const setFormDefault = {
  priority: 2,
  stage: 0,
  speed: 1,
  isCheck: false,
  isDel: true,
  isClose: true,
  isArrow: true,
  isPrint: true,
  disk: 1
}
const user = {
  state: {
    token: 'getToken()',
    name: 'admin',
    avatar:
      'https://image.baidu.com/search/detail?ct=503316480&z=&tn=baiduimagedetail&ipn=d&word=admin&step_word=&lid=8980923753406439282&ie=utf-8&in=&cl=2&lm=-1&st=-1&hd=&latest=&copyright=&cs=1902119677,258344230&os=3526618670,2431782315&simid=3426573763,123057590&pn=11&rn=1&di=7410818322373017601&ln=1928&fr=&fmq=1730735680169_R&ic=&s=undefined&se=&sme=&tab=0&width=&height=&face=undefined&is=0,0&istype=2&ist=&jit=&bdtype=0&spn=0&pi=0&gsm=1e&objurl=https%3A%2F%2Fclearhub.tech%2Fwp-content%2Fuploads%2F2018%2F11%2F12.png&rpstart=0&rpnum=0&adpicid=0&nojc=undefined&dyTabStr=MCwzLDEsMiwxMyw3LDYsNSwxMiw5',
    roles: ['admin'],
    oneLogin: true,
    // 高级设置
    setForm: setFormDefault,
  },

  mutations: {
    SET_TOKEN: (state, token) => {
      state.token = token
    },
    SET_NAME: (state, name) => {
      state.name = name
    },
    SET_AVATAR: (state, avatar) => {
      state.avatar = avatar
    },
    SET_ROLES: (state, roles) => {
      state.roles = roles
    },
    setData: (state, obj) => {
      state[obj.name] = obj.data
    }
  },

  actions: {
    // 改变state值
    setDatas: ({ commit }, data) => {
      commit('setData', data)
    },
    // 登录
    Login({ commit }, userInfo) {
      const username = userInfo.username.trim()
      return new Promise((resolve, reject) => {
        login(username, userInfo.password)
          .then((response) => {
            const data = response.data
            setToken(data.token)
            commit('SET_TOKEN', data.token)
          })
          .catch((error) => {
            reject(error)
          })
      })
    },

    // 获取用户信息
    GetInfo({ commit, state }) {
      return new Promise((resolve, reject) => {
        getInfo(state.token)
          .then((response) => {
            const data = response.data
            if (data.roles && data.roles.length > 0) {
              // 验证返回的roles是否是一个非空数组
              commit('SET_ROLES', data.roles)
            } else {
              reject('getInfo: roles must be a non-null array !')
            }
            commit('SET_NAME', data.name)
            commit('SET_AVATAR', data.avatar)
            resolve(response)
          })
          .catch((error) => {
            reject(error)
          })
      })
    },

    // 登出
    LogOut({ commit, state, dispatch }) {
      return new Promise((resolve, reject) => {
        logout(state.token)
          .then(() => {
            commit('SET_TOKEN', '')
            commit('SET_ROLES', [])
            dispatch('chat/closeWebsocket', {}, { root: true }) // 关闭websocket
            removeToken()
            resolve()
          })
          .catch((error) => {
            reject(error)
          })
      })
    },

    // 前端 登出
    FedLogOut({ commit, dispatch }) {
      return new Promise((resolve) => {
        removeToken()
        commit('SET_TOKEN', '')
        dispatch('chat/closeWebsocket', {}, { root: true }) // 关闭websocket
        resolve()
      })
    }
  }
}

export default user

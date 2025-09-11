// import { getAllList, getChatList, bindId, chatBegin } from '@/api/message'
let timeouter = null
let websock = null

// 状态JSON
// 设备状态
const PrinterStatus = {
  I: '空闲',
  B: '忙碌',
  P: '正在打印'
}

// 设备报错
const printer_errors = {
  '0x11': '从光盘仓抓取到光驱时，光盘为空，请添加光盘后点击重试',
  '0x12': '从光盘仓抓取到光驱时，抓取错误，请将该光盘放入光盘仓后点击重试',
  '0x13': '从光盘仓抓取到光驱时，其他错误，请将该光盘放入光盘仓后点击重试',
  '0x14': '从光盘仓抓取到打印托盘时，光盘为空，请添加光盘后点击重试',
  '0x15': '从光盘仓抓取到打印托盘时，抓取错误，请将该光盘放入光盘仓后点击重试',
  '0x16': '从光盘仓抓取到打印托盘时，其他错误，请将该光盘放入光盘仓后点击重试',
  '0x17': '从光驱抓取到打印托盘时，光盘为空，请检查光驱弹出并将该光盘放入后点击重试',
  '0x18': '从光驱抓取到打印托盘时，抓取错误，请将该光盘重新放入光驱后点击重试',
  '0x19': '从光驱抓取到打印托盘时，其他错误，请将该光盘重新放入光驱后点击重试',
  '0x1a': '从打印托盘抓取到出口时，光盘为空，请检查打印托盘弹出并将该光盘放入后点击重试',
  '0x1b': '从打印托盘抓取到出口时，抓取错误，请将光该盘重新放入托盘后点击重试',
  '0x1c': '从打印托盘抓取到出口时，其他错误，请将该光盘重新放入托盘后点击重试',
  '0x1d': '从光驱抓取到出口时，光盘为空，光盘为空，请检查光驱弹出并将该光盘放入后点击重试',
  '0x1e': '从光驱抓取到出口时，抓取错误，请将该光盘重新放入光驱后点击重试',
  '0x1f': '从光驱抓取到出口时，其他错误，请将该光盘重新放入光驱后点击重试',
  '0x21': '作业开始时设备错误，请清除故障后点击重试',
  '0x10001': '通讯失败，请检查设备'
}

// 提交任务报错
const submitErros = {
  '0x1': '读取任务JSON失败',
  '0x3': '新建任务失败',
  '0x4': '新建任务文件夹失败',
  '0x5': '没有任务数量',
  '0x6': '打印参数错误',
  '0x7': '刻录参数错误',
  '0x8': '没有任务',
  '0x9': '模板文件解析失败',
  '0xa': '打印类型错误',
  '0xb': 'csv文件读取失败',
  '0xc': '刻录路径错误',
  '0xd': '新建ISO文件失败',
  '0xe': '更新任务数据失败'
}

// 错误状态
const Error1 = {
  0: '托盘移动错误',
  1: '墨盒类型错误',
  2: '抓取光盘时未检测到光盘光盘已用完',
  3: '光盘掉落',
  4: '墨水车空警告',
  5: '光盘抓手错误',
  6: '抓取多张光盘错误',
  7: '机械臂挂钩错误或者机械臂归位错误'
}

const Error2 = {
  0: '墨水车伺服系统错误',
  1: '墨水车失速错误',
  2: '墨盒数据读取错误',
  3: '打印图像超出范围',
  4: '环境温度超出正常使用范围',
  5: '墨盒短路',
  6: '型号错误',
  7: '缓冲区溢出错误'
}

const Error3 = {
  0: '光盘已经打印'
}

// 光驱信息
const CDName = {
  1: '下光驱',
  2: '上光驱'
}
const CDStatus = {
  0: '无法确定光盘状态',
  1: '没有光盘',
  2: '光驱托盘打开',
  3: '光驱未准备好',
  4: '光盘状态正常，光盘已插入'
}

// 光盘类型
// CD类型：CD：1，DVD：2， DVD_DL:3，BD：4,BD_DL:5,BD_TL:6,BD_QL:7
const diskTypes = {
  1: 'CD',
  2: 'DVD',
  3: 'BD'
}
const CDTypes = {
  1: 'CD',
  2: 'DVD',
  3: 'DVD_DL',
  4: 'BD',
  5: 'BD_DL',
  6: 'BD_TL',
  7: 'BD_QL'
}
const cd_types = [
  {
    value: 1,
    label: 'CD 700MB',
    size: 700 * 1024 * 1024
  },
  {
    value: 2,
    label: 'DVD 4.7GB',
    size: 4.7 * 1024 * 1024 * 1024
  },
  {
    value: 3,
    label: 'DVD_DL 8.5GB',
    size: 8.5 * 1024 * 1024 * 1024
  },
  {
    value: 4,
    label: 'BD 25GB',
    size: 25 * 1024 * 1024 * 1024
  },
  {
    value: 5,
    label: 'BD_DL 50GB',
    size: 50 * 1024 * 1024 * 1024
  },
  {
    value: 6,
    label: 'BD_TL 100GB',
    size: 100 * 1024 * 1024 * 1024
  },
  {
    value: 7,
    label: 'BD_QL 128GB',
    size: 128 * 1024 * 1024 * 1024
  }
]

const defaultData = {
  // 任务列表
  task_list: [
    // {
    //   task_uuid: '202042152',
    //   task_name: '复制任务',
    //   finish_freq: 2,
    //   total_freq: 10,
    //   task_status: 5,
    //   ass_task: [
    //     {
    //       task_size: 100000,
    //       cd_type: 2,
    //       start_time: '2024-04-01 12:00:00',
    //       finish_time: '2024-04-01 12:00:00',
    //       task_status: 5
    //     },
    //     {
    //       task_size: 100000,
    //       cd_type: 2,
    //       start_time: '2024-04-01 12:00:00',
    //       finish_time: '2024-04-01 12:00:00',
    //       task_status: 5
    //     }
    //   ]
    // },
    // {
    //   task_uuid: '202042152',
    //   task_name: '复制任务',
    //   finish_freq: 2,
    //   total_freq: 10,
    //   task_status: 2,
    //   ass_task: [
    //     {
    //       task_size: 100000,
    //       cd_type: 2,
    //       start_time: '2024-04-01 12:00:00',
    //       finish_time: '2024-04-01 12:00:00',
    //       task_status: 2
    //     },
    //     {
    //       task_size: 100000,
    //       cd_type: 2,
    //       start_time: '2024-04-01 12:00:00',
    //       finish_time: '2024-04-01 12:00:00',
    //       task_status: 2
    //     }
    //   ]
    // }
  ],
  // 设备信息
  printer_info: {
    blue_last: 0, //蓝色墨盒遗留
    calibration_flag: 0, // 是否校验设备
    lack_ink: 0, // 缺墨警告
    cover_flag: false, //是否盖盖
    printer_name: '4200', //设备名称
    printer_status: 'I', //设备状态 数字转成字符为I
    printer_tray: 'I', //设备托盘状态 数字转成字符为I
    red_last: 0, //红色墨盒遗留
    yellow_last: 0, //黄色墨盒遗留
    system_ip: '', //主机IP
    system_name: '', //主机名称
    // 左右盘仓
    strong_list: [
      {
        strong_pos: 1, // 1：右盘仓，2：左盘仓
        cd_type: 1, //CD类型：CD：1，DVD：2， DVD_DL:3，BD：4,BD_DL:5,BD_TL:6,BD_QL:7
        cd_num: 0
      },
      {
        strong_pos: 2,
        cd_type: 2,
        cd_num: 0
      }
    ],
    strongList: {
      1: {
        strong_pos: 1,
        cd_type: 1,
        cd_num: 0
      },
      2: {
        strong_pos: 2,
        cd_type: 2,
        cd_num: 0
      }
    }
  },
  // 光驱信息
  cd_list: [
    {
      cd_pos: 2, // 设备位置 1：下光驱，2：上光驱
      cd_status: 1, // 设备状态 0：无法确定光盘状态 ，1：没有光盘 ， 2：光驱托盘打开， 3：光驱未准备好，4：光盘状态正常，光盘已插入
      cd_taskid: '', // 当前任务id
      dev_path: '', // 光驱路径
      dev_type: 1, // 光驱类型
      cd_assid: '', // 作业的卷标名
      total_size: 0, // 总容量
      use_size: 0, // 已使用容量
      copy_scheduler: 0 // 任务进度
    },
    {
      cd_pos: 1,
      cd_status: 1,
      cd_taskid: '',
      dev_path: '',
      dev_type: 2
    }
  ],
  // 日志信息
  logList: [
    // {
    //   time: '2024-04-01 12:00:00',
    //   text: '任务开始',
    //   status: 'INFO'
    // }
  ],
  allLogList: [],
  // 手动设置光驱
  cdList: [
    // {
    //   "dev_path":"/dev/sre",
    //   "dev_name":"Finger Module 0110"
    // },
    // {
    //   "dev_path":"/dev/sre",
    //   "dev_name":"PIONEER BD-RW BDR-289M 1.54"
    // },
    // {
    //   "dev_path":"/dev/sre",
    //   "dev_name":"PIONEER BD-RW BDR-1313M 3.54"
    // }
  ],
  // 系统配置
  settings: {
    log_level: 1,
    retry_freq: 2,
    cache_path: '/home/test/CDFile'
  }
}

const getDefaultState = () => {
  return {
    isConnect: false,
    connecting: false,
    serviceStatus: false,
    workStatus: true,
    reconnections: 0,
    PrinterStatus,
    CDName,
    CDStatus,
    diskTypes,
    CDTypes,
    cd_types,
    refreshTime: 10,
    // 错误信息
    printer_error: {},
    ...defaultData
  }
}

const state = getDefaultState()

const mutations = {
  setData: (state, obj) => {
    state[obj.name] = obj.data
  }
}

const actions = {
  // 改变state值
  setDatas: ({ commit }, data) => {
    commit('setData', data)
  },
  // 初始化websocket
  initWebSocket({ state, commit, dispatch, rootState }) {
    if (typeof WebSocket === 'undefined') return console.log('您的浏览器不支持websocket')
    if ((websock && state.isConnect) || !rootState.user.token || state.connecting) {
      return
    }
    commit('setData', { name: 'connecting', data: true })
    websock = new WebSocket(process.env.VUE_APP_SOCKET_API)
    websock.onmessage = function (res) {
      dispatch('websocketonmessage', res)
    }
    websock.onopen = function (res) {
      dispatch('websocketonopen', res)
    }
    websock.onerror = function (res) {
      dispatch('websocketonerror', res)
    }
    websock.onclose = function (res) {
      dispatch('websocketonclose', res)
    }
  },
  // 接收消息
  websocketonmessage({ state, commit, dispatch }, e) {
    const data = JSON.parse(e.data) // 转json对象
    if (data.resp_name) {
      // 作业列表
      if (data.resp_name === 'task_list') {
        commit('setData', { name: 'task_list', data: data.resp_info.task_list })
        // 设备信息
      } else if (data.resp_name === 'printer_info') {
        let info = data.resp_info
        info.printer_status = String.fromCharCode(info.printer_status)
        info.printer_tray = String.fromCharCode(info.printer_tray)
        let strong_list = {}
        for (let i = 0; i < info.strong_list.length; i++) {
          strong_list[info.strong_list[i].strong_pos] = info.strong_list[i]
        }
        info.strongList = strong_list
        if (info.cover_flag && info.printer_name !== 'SE3') {
          commit('setData', { name: 'printer_error', data: { type: 'error', notify: '设备门盖被打开，请关闭门盖。' } })
        }
        if (info.calibration_flag) {
          commit('setData', { name: 'printer_error', data: { type: 'error', notify: '请先校准设备。' } })
        }
        commit('setData', { name: 'printer_info', data: info })
        // 驱动信息
      } else if (data.resp_name === 'cd_info') {
        const list = data.resp_info.cd_list
        let cds = []
        let isBD = false
        for (let i = 0; i < list.length; i++) {
          if (list[i].dev_type == 3) isBD = true
          if (i === 0) {
            cds.push(list[i])
          } else {
            if (list[i].cd_pos == 2) {
              cds.unshift(list[i])
            } else {
              cds.push(list[i])
            }
          }
        }
        let types = CDTypes
        let typeLists = cd_types
        if (!isBD) {
          types = {}
          for (let key in CDTypes) {
            if (parseInt(key) < 4) types[key] = CDTypes[key]
          }
          typeLists = cd_types.slice(0, 3)
        }
        commit('setData', { name: 'CDTypes', data: types })
        commit('setData', { name: 'cd_types', data: typeLists })
        commit('setData', { name: 'cd_list', data: cds })
        // 手动设置驱动
      } else if (data.resp_name === 'get_all_cdlist') {
        commit('setData', { name: 'cdList', data: data.resp_info.cd_list })
        // 系统配置
      } else if (data.resp_name === 'get_system_config') {
        commit('setData', { name: 'settings', data: data.resp_info })
        // 新增日志
      } else if (data.resp_name === 'add_log') {
        let logs = data.resp_info.add_log
        let loglist = []
        let logLists = [...state.logList]
        for (let i = 0; i < logs.length; i++) {
          let texts = logs[i].split('|')
          if (logLists.length > 20) logLists.splice(logLists.length - 1, 1)
          loglist.unshift({
            time: texts[0].replace(/\//g, '-').replace(/时/g, ':').replace(/分/g, ':').replace(/秒/g, ''),
            text: texts[2].replace(texts[2].split(' ')[0], ''),
            status: texts[1]
          })
        }
        let list = [...loglist, ...logLists]
        commit('setData', { name: 'logList', data: list })
        // 全部日志
      } else if (data.resp_name === 'all_log') {
        let logs = data.resp_info.add_log
        let loglist = []
        for (let i = 0; i < logs.length; i++) {
          let texts = logs[i].split('|')
          loglist.unshift({
            time: texts[0].replace(/\//g, '-').replace(/时/g, ':').replace(/分/g, ':').replace(/秒/g, ''),
            text: texts[2].replace(texts[2].split(' ')[0], ''),
            status: texts[1]
          })
        }
        commit('setData', { name: 'logList', data: loglist })
        // 提交任务报错处理
      } else if (data.resp_name === 'submit_task_res') {
        let error = data.resp_info
        let task_res = '0x' + error.task_res.toString(16)
        commit('setData', { name: 'printer_error', data: { type: 'error', notify: '任务' + error.task_uuid + '提交失败：' + submitErros[task_res] } })
        // 打印报错处理
      } else if (data.resp_name === 'printer_error') {
        let error = data.resp_info
        if (error.error1) {
          let errors = error.error1.toString(2).split('').reverse()
          console.log(errors)
          for (let i = 0; i < errors.length; i++) {
            if (errors[i] == 1) {
              setTimeout(() => {
                commit('setData', { name: 'printer_error', data: { type: 'error', notify: Error1[i] } })
              }, 500)
            }
          }
        }
        if (error.error2) {
          let errors = error.error2.toString(2).split('').reverse()
          for (let i = 0; i < errors.length; i++) {
            if (errors[i] == 1) {
              setTimeout(() => {
                commit('setData', { name: 'printer_error', data: { type: 'error', notify: Error2[i] } })
              }, 500)
            }
          }
        }
        if (error.error3) {
          let errors = error.error3.toString(2).split('').reverse()
          for (let i = 0; i < errors.length; i++) {
            if (errors[i] == 1) {
              setTimeout(() => {
                commit('setData', { name: 'printer_error', data: { type: 'error', notify: Error3[i] } })
              }, 500)
            }
          }
        }
        if (error.printer_error) {
          error.printer_error = '0x' + error.printer_error.toString(16)
          let continues = ['0x11', '0x12', '0x13', '0x14', '0x15', '0x16', '0x17', '0x18', '0x19', '0x1a', '0x1b', '0x1c', '0x1d', '0x1e', '0x1f', '0x21']
          let req = continues.indexOf(error.printer_error) > -1 ? 'continue_task' : ''
          if (req) {
            commit('setData', { name: 'printer_error', data: { type: 'error', confirm: printer_errors[error.printer_error], req: req } })
          } else {
            commit('setData', { name: 'printer_error', data: { type: 'error', notify: printer_errors[error.printer_error] } })
          }
        }
      }
    // 执行错误提示
    } else if (data.resp_name === 'autoSetCDDevRes') {
      if (data.resp_info.res_code === 0) {

      } else {
        commit('setData', { name: 'printer_error', data: { type: 'error', notify: '自动设置驱动失败' } })
      }
    } else if (data.resp_name === 'setCDStrongRes') {
      if (data.resp_info.res_code === 0) {

      } else {
        commit('setData', { name: 'printer_error', data: { type: 'error', notify: '设置盘仓失败' } })
      }
    } else if (data.resp_name === 'setCDDeviceRes') {
      if (data.resp_info.res_code === 0) {

      } else {
        commit('setData', { name: 'printer_error', data: { type: 'error', notify: '设置光驱失败' } })
      }
    } else if (data.resp_name === 'cleanErrorRes') {
      if (data.resp_info.res_code === 0) {

      } else {
        commit('setData', { name: 'printer_error', data: { type: 'error', notify: '清除错误失败' } })
      }
    } else if (data.resp_name === 'CaliCDStoneRes') {
      if (data.resp_info.res_code === 0) {

      } else {
        commit('setData', { name: 'printer_error', data: { type: 'error', notify: '校准盘仓失败' } })
      }
    } else if (data.resp_name === 'CaliPrinterRes') {
      if (data.resp_info.res_code === 0) {

      } else {
        commit('setData', { name: 'printer_error', data: { type: 'error', notify: '校准打印机失败' } })
      }
    } else if (data.resp_name === 'TransportModeRes') {
      if (data.resp_info.res_code === 0) {

      } else {
        commit('setData', { name: 'printer_error', data: { type: 'error', notify: '进入运输模式失败' } })
      }
    } else if (data.resp_name === 'RefreshCdNumRes') {
      if (data.resp_info.res_code === 0) {

      } else {
        commit('setData', { name: 'printer_error', data: { type: 'error', notify: '刷新CD数量失败' } })
      }
    } else {
      // 未知消息
      console.log('未知消息: ' + JSON.stringify(data))
    }
  },
  // 心跳检测重连
  pingCheck({ state, commit, dispatch, rootState }) {
    if (state.pingNum < 4) {
      state.pingNum++
      timeouter = setTimeout(() => {
        dispatch('pingCheck')
      }, 10000)
    } else {
      dispatch('closeWebsocket')
    }
  },
  // 发送消息
  websocketsend({ commit, dispatch }, res) {
    return new Promise((resolve, reject) => {
      if (!state.serviceStatus) {
        commit('setData', { name: 'printer_error', data: { type: 'warning', message: '服务连接中，请耐心等待' } })
        reject()
        return
      }
      if (!state.isConnect) {
        commit('setData', { name: 'printer_error', data: { type: 'warning', message: '请先打开服务' } })
        reject()
        return
      }
      websock.send(JSON.stringify(res))
      resolve()
    })
  },
  // 链接建立之后执行的方法
  websocketonopen: ({ commit, dispatch }, res) => {
    console.log('链接建立之后执行send方法发送数据', res)
    commit('setData', { name: 'connecting', data: false })
    commit('setData', { name: 'isConnect', data: true })
    commit('setData', { name: 'serviceStatus', data: true })
  },
  // 链接关闭之后执行的方法
  websocketonclose: ({ state, commit, dispatch }, res) => {
    console.log('断开链接', res)
    // 关闭
    commit('setData', { name: 'connecting', data: false })
    commit('setData', { name: 'isConnect', data: false })
    for (let key in defaultData) {
      commit('setData', { name: key, data: defaultData[key] })
    }
    if (state.workStatus) {
      const refreshTime = parseInt(state.refreshTime) * 1000
      setTimeout(() => {
        dispatch('initWebSocket')
      }, refreshTime)
    }
  },
  // 链接错误之后执行的方法
  websocketonerror({ state, commit, dispatch }, res) {
    commit('setData', { name: 'connecting', data: false })
    commit('setData', { name: 'isConnect', data: false })
    commit('setData', { name: 'serviceStatus', data: false })
    state.reconnections += 1
    const refreshTime = parseInt(state.refreshTime) * 1000
    setTimeout(() => {
      dispatch('initWebSocket')
    }, refreshTime)
  },
  // 关闭
  closeWebsocket: () => {
    // 关闭
    if (websock) websock.close()
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}

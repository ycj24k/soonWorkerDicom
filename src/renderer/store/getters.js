const getters = {
  language: state => state.app.language,
  size: state => state.app.size,
  device: state => state.app.device,
  token: state => state.user.token,
  avatar: state => state.user.avatar,
  name: state => state.user.name,
  roles: state => state.user.roles,
  isVerified: state => state.app.isVerified,
  systemName: state => state.app.isVerified ? 'SoonWorkerDicom' : 'SoonWorkerDicom Beta'
}
export default getters

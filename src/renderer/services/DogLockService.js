import { ipcRenderer } from 'electron';

class DogLockService {
    /**
     * 检查加密狗状态 (通过 IPC 调用主进程)
     * @returns {Promise<{verified: boolean, systemName: string}>}
     */
    async checkLicense() {
        console.log('DogLockService: Invoking Main Process verification...');
        try {
            // 调用主进程验证逻辑
            const result = await ipcRenderer.invoke('verify-license');
            if (!result.verified) {
                console.warn('DogLockService: Verification failed.');
                console.warn('Reason:', result.failReason);
                if (result.error) console.error('Error Details:', result.error);
                if (result.dllPath) console.log('Attempted DLL Path:', result.dllPath);
            }
            console.log('DogLockService: Main Process returned:', result);
            return result;
        } catch (error) {
            console.error('DogLockService: IPC Verification failed:', error);
            return { verified: false, systemName: 'SoonWorkerDicom Beta' };
        }
    }
}

export default new DogLockService();

import localforage from 'localforage';

// 配置 localforage
localforage.config({
  name: 'SoonWorkerDicom', // 应用名称
  storeName: 'dicomDB', // 数据库名称
});

// 定义一个永不过期的标志
const NEVER_EXPIRES_FLAG = -1;

/**
 * 设置存储项
 * @param key 键名
 * @param value 值
 * @param expired 过期时间（分钟），默认永不过期
 * @returns Promise
 */
export const setItem = (key, value, expired = -1) => {
  const expiredKey = `${key}__expires__`;
  let exp = 0;

  if (expired === NEVER_EXPIRES_FLAG) {
    exp = NEVER_EXPIRES_FLAG;
  } else if (expired >= 0) {
    exp = Date.now() + 1000 * 60 * expired; // 将过期时间转换为时间戳
  }

  // 存储过期时间
  localforage.setItem(expiredKey, exp.toString()).catch((err) => {
    console.error('设置过期时间失败:', err);
  });

  // 存储实际数据
  return localforage.setItem(key, value);
};

/**
 * 获取存储项
 * @param key 键名
 * @returns Promise<any | null>
 */
export const getItem = async (key) => {
  const expiredKey = `${key}__expires__`;

  try {
    const expiredValue = await localforage.getItem(expiredKey);

    if (expiredValue === null) {
      // 未设置过期时间，视为不存在
      return null;
    }

    const expiredTime = parseInt(expiredValue, 10);

    if (expiredTime === NEVER_EXPIRES_FLAG) {
      // 永不过期
      return localforage.getItem(key);
    }

    if (expiredTime > Date.now()) {
      // 未过期，返回数据
      return localforage.getItem(key);
    } else {
      // 已过期，删除数据
      removeItem(key);
      return null;
    }
  } catch (err) {
    console.error('获取数据失败:', err);
    return null;
  }
};

/**
 * 删除存储项
 * @param key 键名
 * @returns Promise
 */
export const removeItem = (key) => {
  const expiredKey = `${key}__expires__`;
  localforage.removeItem(expiredKey).catch((err) => {
    console.error('删除过期时间失败:', err);
  });
  return localforage.removeItem(key);
};

/**
 * 清空数据库
 */
export const clearAll = () => {
  // 清空整个数据库
  localforage.clear()
  .then(() => {
    // console.log('Kobetools 数据库已清空');
  })
  .catch((error) => {
    console.error('清空数据库失败:', error);
  });
};

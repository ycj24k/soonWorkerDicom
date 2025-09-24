<template>
  <div class="container_box">
    <div class="flex_box flex_row_between header_box">
      <div class="header_title">SOONDICOMER</div>
      <div class="flex_box header_btns">
        <el-button @click="closeApp" icon="el-icon-close" class="header_btn"></el-button>
      </div>
    </div>
    <div class="flex_box flex_col_top action_box">
      <div class="flex_box flex_col_top action_items">
        <div @click="selectPath" class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div class="action_btn" :class="{ 'action_btn1': actionClick == 3 }" @mousedown="actionClick = 3"
              @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action3.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">打开</div>
          </div>
        </div>
      </div>
      <div class="flex_box flex_col_top action_items">
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div class="action_btn" :class="{ 'action_btn1': actionClick == 1 }" @mousedown="actionClick = 1"
              @mouseup="actionClick = 0">
              <img class="action_img action_img1" src="@/assets/images/action1.png" />
            </div>
            <div class="action_btn" :class="{ 'action_btn1': actionClick == 2 }" @mousedown="actionClick = 2"
              @mouseup="actionClick = 0">
              <img class="action_img action_img1" src="@/assets/images/action2.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name">影像排列</div>
            <div class="action_line"></div>
          </div>
        </div>
      </div>
      <div class="flex_box flex_col_top action_items">
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div @click="resetCornerstoneTools" class="action_btn" :class="{ 'action_btn1': actionClick == 4 }"
              @mousedown="actionClick = 4" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action4.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">重新载入</div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div @click="rotate(-90)" class="action_btn" :class="{ 'action_btn1': actionClick == 5 }"
              @mousedown="actionClick = 5" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action5.png" />
            </div>
            <div @click="rotate(90)" class="action_btn" :class="{ 'action_btn1': actionClick == 6 }"
              @mousedown="actionClick = 6" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action6.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name">旋转</div>
            <div class="action_line"></div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div @click="flipHorizontal" class="action_btn" :class="{ 'action_btn1': actionClick == 7 }"
              @mousedown="actionClick = 7" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action7.png" />
            </div>
            <div @click="flipVertical" class="action_btn" :class="{ 'action_btn1': actionClick == 8 }"
              @mousedown="actionClick = 8" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action8.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name">翻转</div>
            <div class="action_line"></div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div @click="fitToWindow" class="action_btn" :class="{ 'action_btn1': actionClick == 9 }"
              @mousedown="actionClick = 9" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action9.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">最适大小</div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div @click="invertImage" class="action_btn" :class="{ 'action_btn1': actionClick == 10 }"
              @mousedown="actionClick = 10" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action10.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">黑白反转</div>
          </div>
        </div>
      </div>
      <div class="flex_box flex_col_top action_items">
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div @click="handleAction(11)" class="action_btn" :class="{ 'action_btn1': actionClick == 11 }"
              @mousedown="actionClick = 11" @mouseup="actionClick = 0">
              <img class="action_img action_img1" src="@/assets/images/action11.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">缩放</div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div @click="handleAction(12)" class="action_btn" :class="{ 'action_btn1': actionClick == 12 }"
              @mousedown="actionClick = 12" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action12.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">平移</div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div @click="handleAction(13)" class="action_btn" :class="{ 'action_btn1': actionClick == 13 }"
              @mousedown="actionClick = 13" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action13.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">像素值</div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div class="action_btn" :class="{ 'action_btn1': actionClick == 14 || activeAction == 14 }"
              @mousedown="actionClick = 14" @mouseup="actionClick = 0">
              <img class="action_img action_img1" src="@/assets/images/action14.png" />
              <img v-if="activeAction == 14" class="action_img_active" :src="cwImgs[active2].img" />
              <div @click="handleAction(14)" class="action_btn_content"></div>
              <el-popover v-model="cwShow" placement="bottom" trigger="click">
                <div class="flex_box" style="width: auto;gap: 10px;">
                  <div v-for="(item, index) in cwImgs" :key="index">
                    <img @click="cwChange(index)" style="cursor: pointer;" :src="item.img" />
                  </div>
                </div>
                <div slot="reference" class="action_btn_r"></div>
              </el-popover>
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">窗宽窗位</div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div class="action_btn" :class="{ 'action_btn1': actionClick == 15 }" @mousedown="actionClick = 15"
              @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action15.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">定位线</div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div class="action_btn" :class="{ 'action_btn1': actionClick == 16 }" @mousedown="actionClick = 16"
              @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action16.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">单张播放</div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div class="action_btn" :class="{ 'action_btn1': actionClick == 17 }" @mousedown="actionClick = 17"
              @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action17.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">点距调整</div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div @click="showInfo" class="action_btn" :class="{ 'action_btn1': actionClick == 18 }"
              @mousedown="actionClick = 18" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action18.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">图像信息</div>
          </div>
        </div>
      </div>
      <div class="flex_box flex_col_top action_items">
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div @click="clearAllMeasurements" class="action_btn" :class="{ 'action_btn1': actionClick == 19 }"
              @mousedown="actionClick = 19" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action19.png" />
            </div>
            <div @click="handleAction(20)" class="action_btn" :class="{ 'action_btn1': actionClick == 20 }"
              @mousedown="actionClick = 20" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action20.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name">选择</div>
            <div class="action_line"></div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div @click="handleAction(21)" class="action_btn" :class="{ 'action_btn1': actionClick == 21 }"
              @mousedown="actionClick = 21" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action21.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">长度</div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div @click="handleAction(22)" class="action_btn" :class="{ 'action_btn1': actionClick == 22 }"
              @mousedown="actionClick = 22" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action22.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">角度</div>
          </div>
        </div>
        <div class="action_item">
          <div class="flex_box flex_col_top action_btns">
            <div @click="handleAction(23)" class="action_btn" :class="{ 'action_btn1': actionClick == 23 }"
              @mousedown="actionClick = 23" @mouseup="actionClick = 0">
              <img class="action_img" src="@/assets/images/action23.png" />
            </div>
          </div>
          <div class="flex_box flex_row_center action_b">
            <div class="action_name action_name1">面积</div>
          </div>
        </div>
      </div>
    </div>
    <div class="flex_box content_box">
      <div class="left_box">
        <div class="tree_box">
          <div class="flex_box tree_title">
            <div>浏览</div>
          </div>
          <div class="tree_list">
            <el-tree :data="dataTree"></el-tree>
          </div>
        </div>
        <div class="list_box">
          <div class="flex_box list_title">
            <div>系列</div>
          </div>
          <div class="dicom_container">
            <div class="dicom_item" :class="{ 'dicom_item1': activeList === index }" v-for="(item, index) in thumbnails"
              :key="index" @click="previewDicom(item, index)">
              <el-popover placement="right" trigger="hover">
                <div class="dicom_content">
                  <div class="dicom_content_item">Modality : {{ item.modality }}</div>
                  <div class="dicom_content_item">Series No : {{ item.seriesNo }}</div>
                  <div class="dicom_content_item">Series Date : {{ item.seriesDate }}</div>
                  <div class="dicom_content_item">Series Time : {{ item.seriesTime }}</div>
                  <div class="dicom_content_item">Description : {{ item.description }}</div>
                  <div class="dicom_content_item">SeriesUID : {{ item.seriesUID }}</div>
                </div>
                <img slot="reference" class="dicom_img" :src="item.image" />
              </el-popover>
              <div class="dicom_info">
                <div class="dicom_info_item">S : {{ item.seriesNo }}</div>
                <div class="dicom_info_item">[{{ index + 1 }}]</div>
                <div class="dicom_info_item">{{ templates[index].children.length + '/' +
                  templates[index].children.length }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div ref="dicomViewer" id="dicomViewer" :style="{ cursor: currentCursor }"></div>
      <!-- 图像上层信息 -->
      <template v-if="dictList.length">
        <div class="top_info top_info1">
          <div class="top_info_item" style="margin-bottom: 20px;">{{ getDict('00100010') }}</div>
          <div class="top_info_item">({{ getDict('00101010') }}/{{ getDict('00100040') }})</div>
          <div class="top_info_item">{{ getDict('00100030') }}</div>
          <div class="top_info_item">{{ getDict('00100020') }}</div>
          <div class="top_info_item">{{ getDict('00080050') }}</div>
        </div>
        <div class="top_info top_info2">
          <div class="top_info_item">Study Date : {{ getDict('00080020') }}</div>
          <div class="top_info_item">Study Time : {{ getDict('00080030') }}</div>
          <div class="top_info_item">{{ getDict('00080080') }}</div>
          <div class="top_info_item">{{ getDict('00081030') }}</div>
          <div class="top_info_item">Series No : {{ getDict('00200011') }}</div>
          <div class="top_info_item">Image No : {{ activeImg+1 }}</div>
          <div class="top_info_item">Acq Time : {{ getDict('00080032') }}</div>
        </div>
        <div class="top_info top_info3">
          <div class="top_info_item">11cm</div>
          <div class="top_info_item">188%</div>
          <div class="top_info_item">{{ getDict('00081090') }}</div>
          <div class="top_info_item">{{ getDict('00081010') }}</div>
          <div class="top_info_item">{{ getDict('00080070') }}</div>
          <div class="top_info_item" style="margin-top: 20px;">W= 400 L= 40</div>
        </div>
        <div class="top_x">
          <div class="flex_box flex_col_bottom top_x_lines">
            <div class="top_x_line" :class="{'top_x_line1': index%5===0}" v-for="(item, index) in xData" :key="index"></div>
          </div>
          <div class="top_x_text">P</div>
        </div>
        <div class="flex_box top_y">
          <div class="flex_box flex_col flex_col_bottom top_y_lines">
            <div class="top_y_line" :class="{'top_y_line1': index%5===0}" v-for="(item, index) in yData" :key="index"></div>
          </div>
          <div class="top_y_text">L</div>
        </div>
      </template>
    </div>
    <!-- 图像信息 -->
    <image-info ref="imageInfo" class="image-info"></image-info>
  </div>
</template>

<script>
import * as cornerstone from 'cornerstone-core';
import * as dicomParser from "dicom-parser";
import cw1 from '@/assets/images/action14-1.png'
import cw2 from '@/assets/images/action14-2.png'
import cw3 from '@/assets/images/action14-3.png'
import cw4 from '@/assets/images/action14-4.png'
import { setItem, getItem } from '@/utils/localforage';
import ImageInfo from './components/image-info.vue';

const { ipcRenderer } = require('electron');
let fs = require('fs')
let path = require('path')
const dcmjs = require('dcmjs');
const { app, dialog } = require('@electron/remote')
const { exec } = require('child_process')
import { Notification } from 'element-ui';
// 移除无用的babel-core导入
let that
// 获取图像数据
async function generateThumbnailList(dicomFileList, targetWidth = 1024) {
  let thumbnails = [];
  let dicomDict = [];

  for (const file of dicomFileList) {
    try {
      // 读取文件内容
      const response = await fetch(file.children[0].path);
      const arrayBuffer = await response.arrayBuffer();
      const byteArray = new Uint8Array(arrayBuffer);

      // 解析 DICOM 文件
      const dataSet = dicomParser.parseDicom(byteArray);
      const image = await cornerstone.loadImage('wadouri:' + file.children[0].path);
      // 创建Canvas渲染
      const canvas = document.createElement('canvas');
      canvas.width = 256;  // 缩略图宽度
      canvas.height = 256 * (image.rows / image.columns); // 保持比例
      // 渲染图像
      cornerstone.renderToCanvas(canvas, image);

      // 转换为Base64
      const thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.9); // 质量参数0.9保证清晰度
      const thumbnail = {
        modality: dataSet.string("x00080060"), // 方式
        seriesNo: dataSet.string("x00200011"), // 序列序号
        seriesDate: dataSet.string("x00080021"), // 序列日期
        seriesTime: dataSet.string("x00080031"), // 序列时间
        description: dataSet.string("x0008103e"), // 序列描述
        seriesUID: dataSet.string("x0020000e"), // 序列UID
        image: thumbnailBase64
      }
      const result = [];
      for (const tag of Object.keys(dataSet.elements)) {
        let dict = dcmjs.data.DicomMetaDictionary.dictionary[`(${tag.slice(1, 5)},${tag.slice(5)})`]
        let description = dict && dict.name ? dict.name : 'Unknown Item';
        let value = '';
        if (dataSet.string(tag)) {
          value = dataSet.string(tag).slice(0, 50)
        }
        result.push({
          tag: `${tag.slice(1)}`,
          description,
          value
        });
      }
      dicomDict.push(result)
      thumbnails.push(thumbnail)
    } catch (error) {
    }
  }

  setItem('dicomDict', dicomDict)
  return {
    thumbnails,
    dicomDict,
  };
}

function getDirectoryTree(directory) {
  const tree = {
    name: path.basename(directory),
    path: directory,
    children: []
  };

  const items = fs.readdirSync(directory, { withFileTypes: true });

  items.forEach(item => {
    const fullPath = path.join(directory, item.name);
    if (item.isDirectory()) {
      // 如果是目录，递归获取子目录
      tree.children.push(getDirectoryTree(fullPath));
    } else {
      // 如果是文件，直接添加到children
      tree.children.push({
        name: item.name,
        path: fullPath,
        isFile: true
      });
    }
  });

  return tree;
}

// 获取树的最大深度
function getMaxDepth(node) {
  if (!node.children || node.children.length === 0) {
    return 0;
  }
  return 1 + Math.max(...node.children.map(child => getMaxDepth(child)));
}

// 获取树结构的最后两层数据
function getLastTwoLayers(tree) {
  const result = { secondLastLayer: [], lastLayer: [] };
  // 从根节点开始遍历，初始深度为树的高度
  const maxDepth = getMaxDepth(tree);
  if (maxDepth != 4 && maxDepth != 3) {
    Notification({
      message: `DICOM数据格式错误，请检查数据格式！`,
      type: 'warning'
    })
    return false
  }
  // 递归函数
  function traverse(node, depth) {
    if (depth === 3) {
      // 当前节点是倒数第3层
      result.lastLayer.push(node);
    } else if (depth === 1) {
      // 当前节点是倒数第二层
      result.secondLastLayer.push(node);
    }

    if (node.children) {
      node.children.forEach(child => {
        traverse(child, depth - 1);
      });
    }
  }
  traverse(tree, maxDepth);

  return result;
}

// 构建结构树 - 支持动态目录结构
async function buildTree(tree, max) {
  let num = 0
  let dicomDict = []
  dicomDict = await getItem('dicomDict')
  
  // 递归构建树节点标签
  function buildNodeLabels(node, parentId = '', depth = 0) {
    node.id = parentId ? `${parentId}-${num++}` : `${num++}`;
    
    // 根据深度和DICOM字典设置标签
    if (depth === 0) {
      // 根节点（患者层）
      if (dicomDict[num] && Array.isArray(dicomDict[num])) {
        const patientId = dicomDict[num].find(item => item.tag === '00100020');
        const patientName = dicomDict[num].find(item => item.tag === '00100010');
        if (patientId && patientName) {
          node.label = `ID:${patientId.value}/Name:${patientName.value}`;
        } else {
          node.label = node.name;
        }
      } else {
        node.label = node.name;
      }
    } else if (depth === 1) {
      // 研究层
      if (dicomDict[num] && Array.isArray(dicomDict[num])) {
        const studyDate = dicomDict[num].find(item => item.tag === '00080020');
        const modality = dicomDict[num].find(item => item.tag === '00080060');
        const studyDescription = dicomDict[num].find(item => item.tag === '00081030');
        if (studyDate && modality && studyDescription) {
          node.label = `${studyDate.value}: ${modality.value} :${studyDescription.value}`;
        } else {
          node.label = node.name;
        }
      } else {
        node.label = node.name;
      }
    } else if (depth === 2) {
      // 系列层
      if (dicomDict[num] && Array.isArray(dicomDict[num])) {
        const seriesNumber = dicomDict[num].find(item => item.tag === '00200011');
        const seriesDescription = dicomDict[num].find(item => item.tag === '0008103e');
        if (seriesNumber && seriesDescription) {
          node.label = `${seriesNumber.value}:${seriesDescription.value}`;
        } else {
          node.label = node.name;
        }
      } else {
        node.label = node.name;
      }
      num++; // 只有系列层才增加计数器
    } else {
      // 图像层或其他
      node.label = node.name;
    }

    // 递归处理子节点
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child, index) => {
        buildNodeLabels(child, node.id, depth + 1);
      });
    }
  }
  
  // 处理树数组
  if (Array.isArray(tree)) {
    tree.forEach((node, index) => {
      buildNodeLabels(node, `${index}`, 0);
    });
  } else {
    // 处理单个节点
    buildNodeLabels(tree, '0', 0);
  }
  
  return tree;
}

const exePath = !app.isPackaged ? process.cwd() : path.dirname(process.execPath)
export default {
  name: 'Dashboard',
  components: {
    ImageInfo
  },
  data() {
    return {
      dataTree: [], // 默认设置为空，让用户选择DICOM目录
      defaultDirectory: 'DICOM/100MB', // 默认目录
      infoTree: [
        {
          name: 'ID:00100020/Name:00100010',
          children: [
            {
              name: '00080020：00080060/'
            },
          ]
        }
      ],
      targetDirectory: '',
      templates: [],
      dictList: [],
      thumbnails: [],
      activeList: 0, // 当前系列
      activeAction: 0, // 当前操作
      activeActionChild: 0, // 当前操作子操作
      activeImg: 0, // 当前图像
      actionClick: 0,
      // 窗位
      cwImgs: [
        {
          img: cw1,
          ww: 80,
          wc: 35
        },
        {
          img: cw2,
          ww: 400,
          wc: 50
        },
        {
          img: cw3,
          ww: 2000,
          wc: 500
        },
        {
          img: cw4,
          ww: 1500,
          wc: -600
        },
      ],
      cwShow: false,
      // 鼠标样式
      mode: '2', // 当前模式,
      // 坐标轴
      xData: 33,
      yData: 20,
    }
  },
  beforeCreate() {
    ipcRenderer.send('maximize-window');
  },
  mounted() {
    that = this
    that.$cornerstone.enable(that.$refs.dicomViewer) // 启用元素
    that.addTools()
    that.getTemplates()
    
    // 默认加载100MB目录进行调试
    console.log('设置自动加载定时器，默认目录:', that.defaultDirectory);
    setTimeout(() => {
      console.log('=== 开始默认加载100MB目录进行调试 ===');
      that.targetDirectory = that.defaultDirectory;
      console.log('设置目标目录:', that.targetDirectory);
      that.$store.dispatch('setDirectory', that.defaultDirectory);
      console.log('调用getTemplates开始');
      that.getTemplates();
    }, 2000);
  },
  beforeDestroy() {
    this.$cornerstone.disable(this.$refs.dicomViewer)
  },
  computed: {
    currentCursor() {
      const fullPath = this.getCursorPath(`mouse${this.mode}.png`);
      return `url(${fullPath}) 0 0, auto`;
    }
  },
  watch: {
    '$store.state.app.directory': {
      handler(val) {
        this.targetDirectory = val
      },
      immediate: true,
      deep: true
    }
  },
  methods: {
    // 选择操作
    handleAction(e) {
      if (that.activeAction === e) {
        // that.activeAction = 0
        // that.mode = '2'
        // that.$cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 })
        return
      }
      that.activeAction = e
      that.active2 = 0
      switch (e) {
        case 11:
          // 激活缩放
          that.mode = '3'
          that.$cornerstoneTools.setToolActive('Zoom', { mouseButtonMask: 1 })
          break;
        case 12:
          // 激活平移
          that.mode = '2'
          that.$cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 })
          break;
        case 13:
          // 激活像素值
          that.mode = '5'
          that.$cornerstoneTools.setToolActive('Probe', { mouseButtonMask: 1 })
          break;
        case 14:
          // 激活窗位窗帘
          that.mode = '4'
          that.$cornerstoneTools.setToolActive('Wwwc', { mouseButtonMask: 1 })
          break;
        case 20:
          // 激活选择
          that.mode = '1'
          that.$cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 })
          break;
        case 21:
          // 激活长度
          that.mode = '1'
          that.$cornerstoneTools.setToolActive('Length', { mouseButtonMask: 1 })
          break;
        case 22:
          // 激活角度
          that.mode = '1'
          that.$cornerstoneTools.setToolActive('Angle', { mouseButtonMask: 1 })
          break;
        case 23:
          // 激活面积
          that.mode = '1'
          that.$cornerstoneTools.setToolActive('RectangleRoi', { mouseButtonMask: 1 })
          break;
      }
    },
    // 窗位设置
    cwChange(e) {
      that.active2 = e
      that.cwShow = false
      that.handleAction(14)
      if (e > 0) {
        that.$cornerstone.setViewport(that.$refs.dicomViewer, {
          voi: {
            windowWidth: that.cwImgs[e].ww,
            windowCenter: that.cwImgs[e].wc
          }
        });
      }
    },
    // 改变鼠标样式
    getCursorPath(filename) {
      if (process.env.NODE_ENV === 'development') {
        return 'static/cursors/' + filename;
      } else {
        return path.join(process.resourcesPath, 'cursors', filename);
      }
    },
    switchMode(mode) {
      this.mode = mode;
    },
    // 选择路径
    selectPath() {
      dialog
        .showOpenDialog({
          properties: ["openDirectory"],
        })
        .then((res) => {
          if (res.filePaths[0]) {
            that.targetDirectory = res.filePaths[0]
            that.$store.dispatch('setDirectory', that.targetDirectory)
            that.getTemplates()
          }
        });
    },
    // 获取模板文件列表
    async getTemplates() {
      console.log('getTemplates开始，目标目录:', that.targetDirectory);
      
      try {
        // 使用新的DicomService进行分析
        const DicomService = require('../../services/DicomService.js').default;
        const dicomService = new DicomService();
        const directoryTree = dicomService.getDirectoryTree(that.targetDirectory);
        console.log('目录树构建完成:', directoryTree);
        
        const analysis = dicomService.analyzeDicomStructure(directoryTree);
        console.log('DICOM结构分析完成:', analysis);
        
        if (!analysis) {
          console.error('DICOM结构分析失败');
          return false;
        }
        
        if (analysis.isMultiPatient) {
          console.log('多患者目录，患者数量:', analysis.totalPatients);
          // 处理多患者情况
          that.templates = [];
          analysis.patients.forEach(patient => {
            patient.seriesNodes.forEach(series => {
              that.templates.push(series);
            });
          });
        } else {
          console.log('单患者目录，系列数量:', analysis.seriesNodes.length);
          // 单患者情况
          that.templates = analysis.seriesNodes;
        }
        
        console.log('最终系列列表:', that.templates);
        
        if (that.templates.length === 0) {
          console.error('没有找到任何系列');
          return false;
        }
        
        // 生成缩略图列表
        console.log('开始生成缩略图列表');
        const { thumbnails, dicomDict } = await dicomService.generateThumbnailList(that.templates);
        that.thumbnails = thumbnails;
        that.dictList = dicomDict[0] || [];
        setItem('thumbnails', that.thumbnails);
        
        // 构建结构树
        console.log('开始构建结构树');
        that.dataTree = await buildTree(analysis.imageNodes, thumbnails.length);
        
        if (that.templates[0] && that.templates[0].children && that.templates[0].children[0]) {
          console.log('加载第一个图像:', that.templates[0].children[0].path);
          that.loadAndViewImage(that.templates[0].children[0].path);
        }
        
        console.log('getTemplates完成');
      } catch (error) {
        console.error('getTemplates出错:', error);
      }
    },
    async previewDicom(item, index = 0) {
      that.activeList = index
      that.activeImg = 0
      let dicomDict = await getItem('dicomDict')
      that.dictList = dicomDict[index]
      that.loadAndViewImage(that.templates[index].children[0].path)
    },
    async loadAndViewImage(imageId) {
      const StackScrollMouseWheelTool = that.$cornerstoneTools.StackScrollMouseWheelTool
      const imageIds = that.templates[that.activeList].children.map(item => `wadouri:${item.path}`)
      const stack = {
        currentImageIdIndex: 0,
        imageIds
      }
      that.$cornerstone.loadImage('wadouri:' + imageId).then((image) => {
        that.$cornerstone.displayImage(that.$refs.dicomViewer, image)
        that.$cornerstoneTools.addStackStateManager(that.$refs.dicomViewer, ['stack'])
        that.$cornerstoneTools.addToolState(that.$refs.dicomViewer, 'stack', stack)
      })
      that.$cornerstoneTools.addTool(StackScrollMouseWheelTool)
      that.$cornerstoneTools.setToolActive('StackScrollMouseWheel', {})
    },
    addTools() {
      /**
      * options 配置如下：
      * mouseButtonMask 指定鼠标按键：1-鼠标左键、2-鼠标右键、4-鼠标滚轮
      */
      // 添加工具
      that.$cornerstoneTools.addTool(that.$cornerstoneTools.WwwcTool) // 窗宽窗位
      that.$cornerstoneTools.addTool(that.$cornerstoneTools.EllipticalRoiTool) // 椭圆ROI
      that.$cornerstoneTools.addTool(that.$cornerstoneTools.PanTool) // 平移
      that.$cornerstoneTools.addTool(that.$cornerstoneTools.ProbeTool) // 像素值
      that.$cornerstoneTools.addTool(that.$cornerstoneTools.ZoomTool) // 缩放
      that.$cornerstoneTools.addTool(that.$cornerstoneTools.LengthTool) // 测量长度
      that.$cornerstoneTools.addTool(that.$cornerstoneTools.AngleTool) // 测量角度
      that.$cornerstoneTools.addTool(that.$cornerstoneTools.RectangleRoiTool); // 矩形ROI
      // 激活工具
      that.$cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 })
    },
    closeApp() {
      ipcRenderer.send('close-window');
    },
    // 重新载入
    resetCornerstoneTools() {
      const element = that.$refs.dicomViewer;
      const viewport = cornerstone.getViewport(element);

      // 重置窗宽窗位（WW/WC）
      viewport.voi.windowWidth = this.defaultWindowWidth || 400; // 默认值
      viewport.voi.windowCenter = this.defaultWindowCenter || 50; // 默认值

      // 重置缩放和平移
      viewport.scale = 2;
      viewport.translation.x = 0;
      viewport.translation.y = 0;

      that.$cornerstone.setViewport(element, viewport);
      // 清除所有标注数据
      const toolStateManager = that.$cornerstoneTools.globalImageIdSpecificToolStateManager;
      toolStateManager.restoreToolState({}); // 重置为空的工具状态

      // 刷新视图
      that.$cornerstone.updateImage(element);
      that.activeAction = 0
      that.handleAction(12)
    },
    // 旋转影像（以 90 度为步长）
    rotate(degrees = 90) {
      const element = that.$refs.dicomViewer;
      const viewport = that.$cornerstone.getViewport(element);

      // 计算新角度（确保在 0~360 范围内）
      viewport.rotation = (viewport.rotation + degrees) % 360;
      that.$cornerstone.setViewport(element, viewport);
      that.$cornerstone.updateImage(element);
    },
    // 水平翻转
    flipHorizontal() {
      const element = that.$refs.dicomViewer;
      const viewport = that.$cornerstone.getViewport(element);
      viewport.hflip = !viewport.hflip; // 切换状态
      that.$cornerstone.setViewport(element, viewport);
      that.$cornerstone.updateImage(element);
    },
    // 垂直翻转
    flipVertical() {
      const element = that.$refs.dicomViewer;
      const viewport = that.$cornerstone.getViewport(element);
      viewport.vflip = !viewport.vflip; // 切换状态
      that.$cornerstone.setViewport(element, viewport);
      that.$cornerstone.updateImage(element);
    },
    // 最适大小
    fitToWindow() {
      const element = that.$refs.dicomViewer;
      that.$cornerstone.fitToWindow(element);
      that.$cornerstone.updateImage(element);
    },
    // 黑白反转
    invertImage() {
      const element = that.$refs.dicomViewer;
      const viewport = that.$cornerstone.getViewport(element);
      viewport.invert = !viewport.invert; // 切换黑白反转状态
      that.$cornerstone.setViewport(element, viewport);
      that.$cornerstone.updateImage(element);
    },
    // 清除所有度量
    clearAllMeasurements() {
      const element = that.$refs.dicomViewer;
      const toolStateManager = that.$cornerstoneTools.globalImageIdSpecificToolStateManager;
      toolStateManager.restoreToolState({});
      that.$cornerstone.updateImage(element);
    },
    // 获取信息
    getDict(e) {
      let data = this.dictList.find(item => item.tag === e)
      let value = data ? data.value : ''
      return value
    },
    // 展示图像信息
    showInfo() {
      this.$refs.imageInfo.show(this.activeList);
    }
  }
}
</script>

<style lang="scss" scoped>
.container_box {
  height: 100vh;

  .header_box {
    height: 26px;
    -webkit-app-region: drag;

    .header_title {
      font-size: 14px;
      font-weight: bold;
      padding-left: 20px;
    }

    .header_btns {
      .header_btn {
        -webkit-app-region: no-drag;
        border: none;
        font-size: 18px;
        color: #333;
        font-weight: bold;
        height: 26px;
        width: 26px;
        padding: 0;
      }
    }
  }

  .action_box {
    height: 88px;
    padding: 0 10px;
    gap: 15px;

    .action_img {
      width: 35px;
      height: 35px;
    }

    .action_img1 {
      width: 43px;
    }

    .action_img_active {
      position: absolute;
      top: 0;
      left: 0;
      width: 35px;
      height: 35px;
      z-index: 2;
    }

    .action_items {
      .action_item {
        .action_btns {
          .action_btn {
            border-radius: 4px;
            padding: 1px;
            margin: 2px;
            position: relative;
            cursor: pointer;
            height: 37px;

            .action_btn_content {
              position: absolute;
              z-index: 3;
              top: 0;
              left: 0;
              width: 35px;
              height: 35px;
            }

            .action_btn_r {
              position: absolute;
              z-index: 3;
              top: 0;
              right: 0;
              width: 8px;
              height: 35px;
            }
          }

          .action_btn1 {
            border: 1px solid #333;
            padding: 0;
          }
        }

        .action_b {
          position: relative;
          padding-top: 2px;

          .action_name {
            position: relative;
            font-size: 12px;
            color: #4D4D4D;
            padding: 0 6px;
            background-color: #fff;
            text-align: center;
            z-index: 9;
          }

          .action_name1 {
            width: 35px;
            padding: 0;
          }

          .action_line {
            position: absolute;
            width: 96%;
            height: 8px;
            border-width: 0 1px 1px 1px;
            border-color: #444;
            border-style: solid;
            top: 4px;
            left: 2%;
            z-index: 1;
          }
        }
      }
    }
  }

  .content_box {
    align-items: stretch;
    height: calc(100vh - 124px);
    padding: 0 0 0 10px;
    position: relative;

    .left_box {
      width: 20%;
      padding-right: 4px;

      .tree_box {
        border: 1px solid #B1B1B1;
        height: 260px;

        .tree_title {
          height: 28px;
          background: linear-gradient(180deg, #EBEADB 0%, #EBEADB 89%, #CBC7B8 100%);
          padding: 0 14px;
          font-size: 12px;
          color: #7E7E7E;
        }
      }

      .list_box {
        height: calc(100% - 260px);

        .list_title {
          height: 28px;
          background: linear-gradient(180deg, #F8F8F8 0%, #BFBFBF 100%);
          padding: 0 14px;
          font-size: 12px;
          color: #7E7E7E;
        }

        .dicom_container {
          height: calc(100% - 28px);
          overflow-y: scroll;
        }

        .dicom_item {
          background-color: #000;
          cursor: pointer;
          text-align: center;
          position: relative;

          .dicom_img {
            height: 120px;
          }

          .dicom_info {
            position: absolute;
            top: 0;
            left: 0;
            z-index: 2;
            padding: 5px;

            .dicom_info_item {
              font-size: 12px;
              color: #fff;
              line-height: 16px;
            }
          }

          .dicom_content {
            // position: absolute;
            // top: 0;
            // left: 0;
            // z-index: 4;
            padding: 5px;
            background-color: #deffdb;
            text-align: left;

            .dicom_content_item {
              font-size: 12px;
              color: #333;
              line-height: 18px;
              white-space: nowrap;
            }
          }
        }

        .dicom_item1 {
          color: #ffffff;
          border: 3px solid #00C325;
        }
      }
    }

    #dicomViewer {
      width: 80%;
    }

    .top_info {
      position: absolute;
      z-index: 999;
      .top_info_item {
        color: #fff;
        font-size: 13px;
        line-height: 20px;
      }
    }

    .top_info1 {
      top: 0px;
      left: calc(20% + 14px);
    }
    .top_info2 {
      top: 0px;
      right: 4px;
      text-align: right;
    }
    .top_info3 {
      bottom: 15px;
      right: 4px;
      text-align: right;
    }

    .top_x {
      position: absolute;
      z-index: 999;
      left: 50%;
      bottom: 0;
      // transform: translateX(-50%);
      .top_x_lines {
        border-bottom: 1px solid #fff;
        gap: 10px;
        .top_x_line {
          width: 1px;
          height: 4px;
          background-color: #fff;
        }
        .top_x_line1 {
          height: 8px;
        }
      }
      .top_x_text {
        color: #fff;
        font-size: 13px;
        padding-top: 6px;
        text-align: center;
      }
    }
    .top_y {
      position: absolute;
      z-index: 999;
      top: 50%;
      right: 4px;
      transform: translateY(-50%);
      .top_y_lines {
        border-right: 1px solid #fff;
        gap: 10px;
        .top_y_line {
          width: 4px;
          height: 1px;
          background-color: #fff;
        }
        .top_y_line1 {
          width: 8px;
        }
      }
      .top_y_text {
        color: #fff;
        font-size: 13px;
        padding-left: 10px;
        text-align: center;
      }
    }
  }
}
</style>

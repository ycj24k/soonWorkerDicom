<template>
    <div class="">
        <el-dialog center :visible.sync="infoShow" width="75%" top="10vh" title="" :close-on-press-escape="false"
            :close-on-click-modal="false" :show-close="false">
            <div class="info_box">
                <div class="flex_box title_box">
                    <div class="title_icon">
                        <i class="el-icon-info"></i>
                    </div>
                    <div>图像信息</div>
                </div>
                <div class="table_box">
                    <el-table :data="tableData" style="width: 100%" height="100%" border>
                        <el-table-column type="index" width="50">
                        </el-table-column>
                        <el-table-column prop="tag" label="Group - Element" width="150">
                        </el-table-column>
                        <el-table-column prop="description" label="Description" width="300">
                        </el-table-column>
                        <el-table-column prop="value" label="Value">
                        </el-table-column>
                    </el-table>
                </div>
                <div class="flex_box flex_row_end footer_box">
                    <el-button size="small" type="primary" @click="closeDialog">关闭</el-button>
                </div>
            </div>
        </el-dialog>
    </div>
</template>

<script>
import { getItem } from '@/utils/localforage';
export default {
    name: 'ImageInfo',
    data() {
        return {
            infoShow: false,
            tableData: []
        }
    },
    mounted() {

    },
    methods: {
        async show(e) {
            let list = await getItem('dicomDict')
            this.tableData = list[0]
            this.infoShow = true
        },
        closeDialog() {
            this.infoShow = false
        }
    }
}
</script>

<style lang="scss" scoped>
.info_box {
    height: calc(75vh);
    .title_box {
        font-size: 18px;
        color: #333;
        gap: 5px;
        padding: 0 0 12px;
        .title_icon {
            font-size: 30px;
            color: #bec3ff;
        }
    }
    .table_box {
        height: calc(100% - 100px);
        ::v-deep {
            td,th {
                padding: 0;
                color: #000;
                font-size: 10px;
            }
        }
    }
    .footer_box {
        padding: 12px 0 0;
    }
}
</style>

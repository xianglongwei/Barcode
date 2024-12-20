<template>
  <div class="barcode-generator">
    <el-card class="generator-card">
      <h2>条码生成器</h2>
      
      <div class="layout-container">
        <!-- 左侧控制面板 -->
        <div class="control-panel">
          <el-form :model="form" label-width="120px">
            <el-form-item label="条码内容">
              <el-input v-model="form.text" placeholder="请输入要生成的条码内容"></el-input>
            </el-form-item>
            
            <el-form-item label="条码宽度 (mm)">
              <el-input-number 
                v-model="form.width" 
                :min="20" 
                :max="200" 
                :step="5"
                controls-position="right"
              />
            </el-form-item>
            
            <el-form-item label="条码高度 (mm)">
              <el-input-number 
                v-model="form.height" 
                :min="10" 
                :max="100" 
                :step="5"
                controls-position="right"
              />
            </el-form-item>

            <el-form-item label="每行条码数">
              <el-input-number 
                v-model="barcodePerRow" 
                :min="1" 
                :max="4" 
                :step="1"
                controls-position="right"
              />
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="generateBarcode">生成条码</el-button>
              <el-button type="success" @click="printBarcode">打印条码</el-button>
            </el-form-item>
          </el-form>
        </div>

        <!-- 右侧预览区域 -->
        <div class="preview-panel">
          <h3>预览区域</h3>
          <div class="barcode-preview" v-if="barcodeUrl">
            <img :src="barcodeUrl" alt="生成的条码" ref="barcodeImage" />
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const form = reactive({
  text: '',
  width: 100,  // 默认宽度 100mm
  height: 30   // 默认高度 30mm
})

const barcodePerRow = ref(2)  // 默认每行2个条码
const barcodeUrl = ref('')
const barcodeImage = ref(null)

const generateBarcode = async () => {
  try {
    // 将毫米转换为像素 (假设 96 DPI)
    const pxPerMm = 96 / 25.4
    const widthInPx = Math.round(form.width * pxPerMm)
    const heightInPx = Math.round(form.height * pxPerMm)

    const response = await fetch('http://localhost:8000/generate-barcode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: form.text,
        width: widthInPx,
        height: heightInPx
      })
    })
    
    if (response.ok) {
      const blob = await response.blob()
      barcodeUrl.value = URL.createObjectURL(blob)
    }
  } catch (error) {
    console.error('生成条码失败:', error)
  }
}

const printBarcode = () => {
  const printWindow = window.open('', '_blank')
  const perRow = barcodePerRow.value
  
  // 创建打印页面
  printWindow.document.write(`
    <html>
      <head>
        <title>打印条码</title>
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            margin: 0;
            padding: 10mm;
          }
          .barcode-container {
            display: grid;
            grid-template-columns: repeat(${perRow}, 1fr);
            gap: 10mm;
            justify-items: center;
          }
          .barcode-item {
            width: ${form.width}mm;
            height: ${form.height}mm;
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <div class="barcode-container">
          ${Array(12).fill(`
            <div class="barcode-item">
              <img src="${barcodeUrl.value}" />
            </div>
          `).join('')}
        </div>
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.print()
}
</script>

<style scoped>
.barcode-generator {
  margin: 20px;
}

.generator-card {
  max-width: 1400px;
  margin: 0 auto;
}

.layout-container {
  display: flex;
  gap: 40px;
  margin-top: 20px;
}

.control-panel {
  flex: 0 0 400px;
}

.preview-panel {
  flex: 1;
  padding: 20px;
  border-left: 1px solid #eee;
}

.barcode-preview {
  margin-top: 20px;
  text-align: center;
  border: 1px dashed #ddd;
  padding: 20px;
}

.barcode-preview img {
  max-width: 100%;
  height: auto;
}

h2 {
  text-align: center;
  color: #409EFF;
  margin-bottom: 30px;
}

h3 {
  color: #666;
  margin-top: 0;
}
</style> 
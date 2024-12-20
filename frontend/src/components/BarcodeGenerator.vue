<template>
  <div class="barcode-generator">
    <el-card class="generator-card">
      <h2>条码生成器</h2>
      
      <el-form :model="form" label-width="100px">
        <el-form-item label="条码内容">
          <el-input v-model="form.text" placeholder="请输入要生成的条码内容"></el-input>
        </el-form-item>
        
        <el-form-item label="条码宽度">
          <el-slider v-model="form.width" :min="100" :max="800" :step="10"></el-slider>
        </el-form-item>
        
        <el-form-item label="条码高度">
          <el-slider v-model="form.height" :min="50" :max="400" :step="10"></el-slider>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="generateBarcode">生成条码</el-button>
          <el-button type="success" @click="printBarcode">打印条码</el-button>
        </el-form-item>
      </el-form>

      <div class="barcode-preview" v-if="barcodeUrl">
        <img :src="barcodeUrl" alt="生成的条码" ref="barcodeImage" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const form = reactive({
  text: '',
  width: 400,
  height: 200
})

const barcodeUrl = ref('')
const barcodeImage = ref(null)

const generateBarcode = async () => {
  try {
    const response = await fetch('http://localhost:8000/generate-barcode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(form)
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
  printWindow.document.write(`
    <html>
      <head>
        <title>打印条码</title>
        <style>
          body { margin: 20px; }
          img { max-width: 100%; }
        </style>
      </head>
      <body>
        <img src="${barcodeUrl.value}" />
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
  max-width: 800px;
  margin: 0 auto;
}

.barcode-preview {
  margin-top: 20px;
  text-align: center;
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
</style> 
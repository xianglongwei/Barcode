const { createApp, ref, reactive, watch, nextTick } = Vue

const app = createApp({
  setup() {
    const form = reactive({
      text: '',
      width: 190,
      height: 60
    })

    const inputMode = ref('single')  // 输入模式：single 或 batch
    const batchInput = ref('')       // 批量输入的文本
    const batchTexts = ref([])       // 批量处理的文本数组
    const batchBarcodeUrls = ref([]) // 批量生成的条码URL数组
    const barcodePerRow = ref(2)
    const printCount = ref(1)
    const barcodeUrl = ref('')
    const barcodeImage = ref(null)

    // 添加边框相关的响应式变量
    const borderStyle = ref('solid')  // 默认实线
    const borderColor = ref('black')
    const borderWidth = ref(0.2)

    // 添加边框样式计算方法
    const getBorderStyle = () => {
      if (borderStyle.value === 'none') {
        return {}
      }

      let styles = {
        boxSizing: 'border-box'
      }

      // 基本边框样式
      styles.border = `${borderWidth.value}mm ${borderStyle.value} ${borderColor.value}`
      styles.padding = '5px'

      return styles
    }

    // 修改打印时的边框样式处理
    const getBorderStyleForPrint = () => {
      if (borderStyle.value === 'none') return ''
      
      let style = `
        border-style: ${borderStyle.value};
        border-color: ${borderColor.value};
        border-width: ${borderStyle.value === 'double' ? borderWidth.value * 2 : borderWidth.value}mm;
        background-color: #fff;
      `
      return style
    }

    // 生成单个条码
    const generateBarcode = async (text) => {
      if (!text) return null
      
      try {
        const pxPerMm = 96 / 25.4
        const widthInPx = Math.round(form.width * pxPerMm)
        const heightInPx = Math.round(form.height * pxPerMm)

        const response = await fetch('http://localhost:8000/generate-barcode', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
            width: widthInPx,
            height: heightInPx
          })
        })
        
        if (response.ok) {
          const blob = await response.blob()
          return URL.createObjectURL(blob)
        }
      } catch (error) {
        console.error('生成条码失败:', error)
      }
      return null
    }

    // 批量生成条码
    const generateBatchBarcodes = async () => {
      const texts = batchInput.value.split('\n').filter(text => text.trim())
      batchTexts.value = texts
      batchBarcodeUrls.value = []
      
      for (const text of texts) {
        const url = await generateBarcode(text)
        if (url) {
          batchBarcodeUrls.value.push(url)
        }
      }
    }

    // 监听表单��化
    watch(
      () => ({...form, mode: inputMode.value, batchInput: batchInput.value}),
      async () => {
        if (inputMode.value === 'single') {
          if (form.text) {
            barcodeUrl.value = await generateBarcode(form.text)
          }
        } else {
          await generateBatchBarcodes()
        }
      },
      { deep: true }
    )

    // 监听边框设置变化
    watch(
      () => ({
        style: borderStyle.value,
        color: borderColor.value,
        width: borderWidth.value
      }),
      () => {
        // 强制重新渲染预览
        if (inputMode.value === 'single') {
          const currentUrl = barcodeUrl.value
          barcodeUrl.value = ''
          nextTick(() => {
            barcodeUrl.value = currentUrl
          })
        }
      },
      { deep: true }
    )

    // 打印条码
    const printBarcode = () => {
      const printWindow = window.open('', '_blank')
      const urls = inputMode.value === 'single' 
        ? Array(printCount.value).fill(barcodeUrl.value)
        : batchBarcodeUrls.value
      const texts = inputMode.value === 'single'
        ? Array(printCount.value).fill(form.text)
        : batchTexts.value
      
      // A4 纸张尺寸（单位：mm）
      const A4_WIDTH = 210
      const A4_HEIGHT = 297
      const MARGIN = 10  // 页边距 10mm
      
      // 计算可用打印区域
      const printableWidth = A4_WIDTH - (MARGIN * 2)
      const printableHeight = A4_HEIGHT - (MARGIN * 2)

      // 计算每个条码实际占用的空间（包括文本和间距）
      const gapSize = 5  // 条码之间的间距（mm）
      const textHeight = 5  // 文本高度（mm）
      const itemHeight = form.height + textHeight + 2  // 条码高度 + 文本高度 + 边距

      // 计算每页能放置的行数和列数
      const rowsPerPage = Math.floor(printableHeight / (itemHeight + gapSize))
      const colsPerPage = Math.floor(printableWidth / (form.width + gapSize))
      
      // 使用实际可放置的数量，但不超过用户设置的每行��量
      const actualPerRow = Math.min(barcodePerRow.value, colsPerPage)
      const itemsPerPage = actualPerRow * rowsPerPage

      const borderStyles = borderStyle.value !== 'none' 
        ? `
          border: ${borderWidth.value}mm ${borderStyle.value} ${borderColor.value};
          padding: ${gapSize/2}mm;
        `
        : '';

      printWindow.document.write(`
        <html>
          <head>
            <title>打印条码</title>
            <style>
              @page {
                size: A4;
                margin: ${MARGIN}mm;
              }
              body {
                margin: 0;
                padding: 0;
                width: ${printableWidth}mm;
              }
              .barcode-container {
                display: grid;
                grid-template-columns: repeat(${actualPerRow}, 1fr);
                gap: 0;
                justify-content: start;
              }
              .barcode-item {
                width: ${form.width}mm;
                height: ${itemHeight}mm;
                text-align: center;
                page-break-inside: avoid;
                ${borderStyles}
                padding: ${gapSize/2}mm;
                box-sizing: border-box;
                position: relative;
              }
              .barcode-text {
                position: absolute;
                bottom: 1mm;
                left: ${gapSize/2}mm;
                right: ${gapSize/2}mm;
                font-size: 8pt;
                text-align: center;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
              .barcode-image-container {
                height: ${form.height}mm;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              img {
                max-width: 100%;
                max-height: ${form.height}mm;
                object-fit: contain;
              }
              @media print {
                .page-break {
                  break-before: page;
                }
                ${borderStyle.value !== 'none' ? `
                  .barcode-item {
                    ${getBorderStyleForPrint()}
                  }
                ` : ''}
              }
            </style>
          </head>
          <body>
            ${urls.reduce((html, url, i) => {
              // 每页开始时添加新的容器
              if (i % itemsPerPage === 0) {
                if (i > 0) {
                  html += '</div>'
                }
                html += `<div class="barcode-container${i > 0 ? ' page-break' : ''}">`
              }
              
              html += `
                <div class="barcode-item">
                  <div class="barcode-image-container">
                    <img src="${url}" />
                  </div>
                  <div class="barcode-text">${texts[i]}</div>
                </div>
              `
              
              // 最后一个条码时关闭容器
              if (i === urls.length - 1) {
                html += '</div>'
              }
              
              return html
            }, '')}
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }

    return {
      form,
      inputMode,
      batchInput,
      batchTexts,
      batchBarcodeUrls,
      barcodePerRow,
      printCount,
      barcodeUrl,
      barcodeImage,
      printBarcode,
      borderStyle,
      borderColor,
      borderWidth,
      getBorderStyle,
    }
  }
})

app.use(ElementPlus)
app.mount('#app') 
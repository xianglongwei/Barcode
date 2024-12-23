const { createApp, ref, reactive, watch, nextTick } = Vue

const app = createApp({
  setup() {
    const form = reactive({
      text: '',
      width: 190,
      height: 60
    })

    // 添加二维码默认尺寸
    const qrDefaultSize = 50  // 二维码默认尺寸 50mm

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

    // 添加纸张方向的响应式变量
    const pageOrientation = ref('portrait')  // 默认纵向

    // 添加码类型变量
    const codeType = ref('barcode')  // 默认为条形码

    // 监听码类型变化，自动调整尺寸
    watch(codeType, (newType) => {
      if (newType === 'qrcode') {
        form.width = qrDefaultSize
        form.height = qrDefaultSize
      } else {
        form.width = 190
        form.height = 60
      }
    })

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
            height: heightInPx,
            codeType: codeType.value  // 添加码类型
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

    // 修改表单监听
    watch(
      () => ({
        text: form.text,
        mode: inputMode.value,
        batchInput: batchInput.value,
        codeType: codeType.value,
        width: form.width,
        height: form.height
      }),
      async (newVal, oldVal) => {
        // 当文本、模式、批量输入、码类型改变，或者尺寸改变时都重新生成
        if (newVal.text !== oldVal.text || 
            newVal.mode !== oldVal.mode || 
            newVal.batchInput !== oldVal.batchInput || 
            newVal.codeType !== oldVal.codeType ||
            newVal.width !== oldVal.width ||    // 添加宽度变化检测
            newVal.height !== oldVal.height     // 添加高度变化检测
        ) {
          if (inputMode.value === 'single') {
            if (form.text) {
              barcodeUrl.value = await generateBarcode(form.text)
            }
          } else {
            await generateBatchBarcodes()
          }
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
      const MARGIN = 10
      
      // 根据方向设置实际宽高
      const pageWidth = pageOrientation.value === 'portrait' ? A4_WIDTH : A4_HEIGHT
      const pageHeight = pageOrientation.value === 'portrait' ? A4_HEIGHT : A4_WIDTH
      
      // 计算可用打印区域
      const printableWidth = pageWidth - (MARGIN * 2)
      const printableHeight = pageHeight - (MARGIN * 2)

      // 根据码类型设置不同的间距和布局
      const gapSize = codeType.value === 'qrcode' ? 10 : 5  // 二维码间距更大
      const textHeight = 5
      const itemHeight = form.height + textHeight + 2

      // 为二维码优化每行数量计算
      let actualPerRow
      if (codeType.value === 'qrcode') {
        // 二维码根据可用宽度自动计算最佳列数
        const maxColumns = Math.floor(printableWidth / (form.width + gapSize))
        actualPerRow = Math.min(maxColumns, 4)  // 最多4列，避免太小
      } else {
        // 条形码使用用户设置的列数
        const colsPerPage = Math.floor(printableWidth / (form.width + gapSize))
        actualPerRow = Math.min(barcodePerRow.value, colsPerPage)
      }

      // 计算每页行数
      const rowsPerPage = Math.floor(printableHeight / (itemHeight + gapSize))
      const itemsPerPage = actualPerRow * rowsPerPage

      // 定义边框样式
      const borderStyles = borderStyle.value !== 'none' 
        ? `border: ${borderWidth.value}mm ${borderStyle.value} ${borderColor.value};`
        : '';

      // 生成样式
      const styles = `
        @page {
          size: A4 ${pageOrientation.value};
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
          gap: ${gapSize}mm;
          justify-content: center;
          padding: ${codeType.value === 'qrcode' ? '10mm 0' : '0'};
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
          ${codeType.value === 'qrcode' ? 'margin: 0 auto;' : ''}
        }
        .barcode-image-container {
          height: ${form.height}mm;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        img {
          ${codeType.value === 'qrcode' 
            ? `width: ${form.width}mm; height: ${form.height}mm;` 
            : 'width: 100%; height: 100%;'}
          object-fit: contain;
        }
        .barcode-text {
          position: absolute;
          bottom: 1mm;
          left: ${gapSize/2}mm;
          right: ${gapSize/2}mm;
          font-size: ${codeType.value === 'qrcode' ? '10pt' : '8pt'};
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @media print {
          .page-break {
            break-before: page;
          }
        }
      `

      printWindow.document.write(`
        <html>
          <head>
            <title>打印条码</title>
            <style>${styles}</style>
          </head>
          <body>
            ${urls.reduce((html, url, i) => {
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

    // 预览打印
    const previewPrint = () => {
      const previewWindow = window.open('', '_blank')
      const urls = inputMode.value === 'single' 
        ? Array(printCount.value).fill(barcodeUrl.value)
        : batchBarcodeUrls.value
      const texts = inputMode.value === 'single'
        ? Array(printCount.value).fill(form.text)
        : batchTexts.value
      
      // A4 纸张尺寸（单位：mm）
      const A4_WIDTH = 210
      const A4_HEIGHT = 297
      const MARGIN = 10
      
      // 根据方向设置实际宽高
      const pageWidth = pageOrientation.value === 'portrait' ? A4_WIDTH : A4_HEIGHT
      const pageHeight = pageOrientation.value === 'portrait' ? A4_HEIGHT : A4_WIDTH
      
      // 计算可用打印区域
      const printableWidth = pageWidth - (MARGIN * 2)
      const printableHeight = pageHeight - (MARGIN * 2)

      // 计算每个条码实际占用的空间
      const gapSize = 5
      const textHeight = 5
      const itemHeight = form.height + textHeight + 2

      // 计算每能放置的行数和数
      const rowsPerPage = Math.floor(printableHeight / (itemHeight + gapSize))
      const colsPerPage = Math.floor(printableWidth / (form.width + gapSize))
      
      const actualPerRow = Math.min(barcodePerRow.value, colsPerPage)
      const itemsPerPage = actualPerRow * rowsPerPage

      const borderStyles = borderStyle.value !== 'none' 
        ? `border: ${borderWidth.value}mm ${borderStyle.value} ${borderColor.value};`
        : '';

      previewWindow.document.write(`
        <html>
          <head>
            <title>打印预览</title>
            <style>
              @page {
                size: A4 ${pageOrientation.value};
                margin: ${MARGIN}mm;
              }
              body {
                margin: 0;
                padding: 20px;
                background-color: #f0f0f0;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 20px;
              }
              .preview-page {
                background: white;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                width: ${pageWidth}mm;
                height: ${pageHeight}mm;
                position: relative;
                padding: ${MARGIN}mm;
                box-sizing: border-box;
              }
              .barcode-container {
                display: grid;
                grid-template-columns: repeat(${actualPerRow}, 1fr);
                gap: ${gapSize}mm;
                justify-content: start;
              }
              .barcode-item {
                width: ${form.width}mm;
                height: ${itemHeight}mm;
                text-align: center;
                ${borderStyles}
                padding: ${gapSize/2}mm;
                box-sizing: border-box;
                position: relative;
                background: white;
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
              .preview-controls {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 10px;
                border-radius: 4px;
                box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
              }
              .print-button {
                background: #409EFF;
                color: white;
                border: none;
                padding: 8px 15px;
                border-radius: 4px;
                cursor: pointer;
              }
              .print-button:hover {
                background: #66b1ff;
              }
            </style>
          </head>
          <body>
            <div class="preview-controls">
              <button class="print-button" onclick="window.print()">打印</button>
            </div>
            ${urls.reduce((html, url, i) => {
              if (i % itemsPerPage === 0) {
                if (i > 0) {
                  html += '</div></div>'
                }
                html += `<div class="preview-page">
                          <div class="barcode-container">`
              }
              
              html += `
                <div class="barcode-item">
                  <div class="barcode-image-container">
                    <img src="${url}" />
                  </div>
                  <div class="barcode-text">${texts[i]}</div>
                </div>
              `
              
              if (i === urls.length - 1) {
                html += '</div></div>'
              }
              
              return html
            }, '')}
          </body>
        </html>
      `)
      previewWindow.document.close()
    }

    // 监听纸张方向变化
    watch(pageOrientation, (newOrientation) => {
      const maxWidth = newOrientation === 'portrait' ? 190 : 277
      if (form.width > maxWidth) {
        form.width = maxWidth  // 如果当前宽度超过新的最大值，则自动调整
      }
    })

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
      previewPrint,
      pageOrientation,
      codeType,
    }
  }
})

app.use(ElementPlus)
app.mount('#app') 
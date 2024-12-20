from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from barcode import Code128
from barcode.writer import ImageWriter
import qrcode
import io
from PIL import Image
from pydantic import BaseModel
import uvicorn

app = FastAPI()

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BarcodeRequest(BaseModel):
    text: str
    width: int
    height: int
    codeType: str  # 添加码类型字段：'barcode' 或 'qrcode'

@app.post("/generate-barcode")
async def generate_barcode(request: BarcodeRequest):
    try:
        output = io.BytesIO()
        
        if request.codeType == 'qrcode':
            # 生成二维码
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(request.text)
            qr.make(fit=True)
            
            # 创建二维码图片
            qr_image = qr.make_image(fill_color="black", back_color="white")
            # 调整大小
            qr_image = qr_image.resize((request.width, request.height))
            qr_image.save(output, format='PNG')
        else:
            # 生成条码
            rv = io.BytesIO()
            Code128(request.text, writer=ImageWriter()).write(rv)
            
            # 调整图片大小
            image = Image.open(rv)
            image = image.resize((request.width, request.height))
            image.save(output, format='PNG')
        
        output.seek(0)
        return Response(content=output.getvalue(), media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 
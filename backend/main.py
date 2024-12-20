from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from barcode import Code128
from barcode.writer import ImageWriter
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

@app.post("/generate-barcode")
async def generate_barcode(request: BarcodeRequest):
    try:
        # 生成条码
        rv = io.BytesIO()
        Code128(request.text, writer=ImageWriter()).write(rv)
        
        # 调整图片大小
        image = Image.open(rv)
        image = image.resize((request.width, request.height))
        
        # 保存调整后的图片到内存
        output = io.BytesIO()
        image.save(output, format='PNG')
        output.seek(0)
        
        # 直接返回图片数据
        return Response(content=output.getvalue(), media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    # 直接运行服务器，host="0.0.0.0" 允许外部访问
    uvicorn.run(app, host="0.0.0.0", port=8000) 
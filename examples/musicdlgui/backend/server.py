"""
FastAPI backend for musicdl GUI.
Provides WebSocket endpoints for search and download.
"""
import uvicorn
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="musicdl-gui-backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/search")
async def ws_search(websocket: WebSocket):
    await websocket.accept()
    # Stub: will be implemented in Task 2
    await websocket.send_json({"type": "search_done"})
    await websocket.close()


@app.websocket("/ws/download")
async def ws_download(websocket: WebSocket):
    await websocket.accept()
    # Stub: will be implemented in Task 3
    await websocket.send_json({"type": "done"})
    await websocket.close()


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
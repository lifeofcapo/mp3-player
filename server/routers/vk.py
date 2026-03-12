from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.vk_auth import (
    login_step1,
    login_step2,
    delete_session,
    get_session_status,
)

router = APIRouter(prefix="/vk", tags=["vk"])


class LoginRequest(BaseModel):
    login: str
    password: str


class TwoFARequest(BaseModel):
    code: str


@router.get("/status")
async def vk_status():
    return get_session_status()


@router.post("/login")
async def vk_login(req: LoginRequest):
    result = login_step1(req.login.strip(), req.password)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/login/2fa")
async def vk_login_2fa(req: TwoFARequest):
    result = login_step2(req.code.strip())
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.delete("/logout")
async def vk_logout():
    delete_session()
    return {"ok": True}
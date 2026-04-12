from pydantic import BaseModel


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    email: str
    name: str | None
    onboarding_completed: bool = False
    onboarding_step: int = 0
    nylas_grant_id: str | None = None

    class Config:
        from_attributes = True


class UpdateMeRequest(BaseModel):
    email: str | None = None
    name: str | None = None

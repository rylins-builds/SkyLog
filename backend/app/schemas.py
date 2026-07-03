"""
Pydantic schemas (data models) for SkyLog API request/response validation.

Each schema maps to a specific API operation:
- ``FlightCreate``  → POST /api/flights (all required fields are enforced).
- ``FlightUpdate``  → PUT /api/flights/{id} (all fields are optional, only
  provided fields are updated).
- ``FlightResponse`` → GET /api/flights (read-only, includes ``created_at``).
- ``DashboardStats`` → GET /api/dashboard/stats (aggregated server-side).
- Various auth schemas for login, registration, password change, etc.

All numeric time fields default to 0 and are constrained to non-negative
values via Pydantic's ``Field(ge=0)``.
"""

from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class FlightCreate(BaseModel):
    """Schema for creating a new flight entry.

    Most numeric time fields are optional and default to 0.
    ``total_time`` is the only field that must be strictly greater than 0.
    ``date`` is required and accepts a YYYY-MM-DD string (parsed as
    ``datetime.date`` by Pydantic).
    """
    date: date
    aircraft_type: str = Field(..., min_length=1, max_length=50)
    aircraft_reg: str = Field(..., min_length=1, max_length=20)
    departure: str = Field(..., min_length=1, max_length=10)
    arrival: str = Field(..., min_length=1, max_length=10)
    departure_time: Optional[str] = None
    arrival_time: Optional[str] = None
    total_time: float = Field(..., gt=0)
    sel_time: Optional[float] = Field(default=0, ge=0)
    ses_time: Optional[float] = Field(default=0, ge=0)
    mel_time: Optional[float] = Field(default=0, ge=0)
    mes_time: Optional[float] = Field(default=0, ge=0)
    helicopter_time: Optional[float] = Field(default=0, ge=0)
    glider_time: Optional[float] = Field(default=0, ge=0)
    solo_time: Optional[float] = Field(default=0, ge=0)
    pic_time: Optional[float] = Field(default=0, ge=0)
    sic_time: Optional[float] = Field(default=0, ge=0)
    dual_time: Optional[float] = Field(default=0, ge=0)
    instructor_time: Optional[float] = Field(default=0, ge=0)
    xcountry_time: Optional[float] = Field(default=0, ge=0)
    night_time: Optional[float] = Field(default=0, ge=0)
    act_instrument_time: Optional[float] = Field(default=0, ge=0)
    sim_instrument_time: Optional[float] = Field(default=0, ge=0)
    sim_time: Optional[float] = Field(default=0, ge=0)
    pilot_in_command: str = Field(..., min_length=1, max_length=100)
    remarks: Optional[str] = None
    takeoffs_day: Optional[int] = Field(default=0, ge=0)
    takeoffs_night: Optional[int] = Field(default=0, ge=0)
    landings_day: Optional[int] = Field(default=0, ge=0)
    landings_night: Optional[int] = Field(default=0, ge=0)
    precision_approaches: Optional[int] = Field(default=0, ge=0)
    non_precision_approaches: Optional[int] = Field(default=0, ge=0)
    holding_patterns: Optional[int] = Field(default=0, ge=0)


class FlightUpdate(BaseModel):
    """Schema for updating an existing flight entry.

    All fields are optional. Only the fields present in the request body
    will be updated on the database row. If the request body is empty,
    the existing record is returned unchanged.
    """
    aircraft_type: Optional[str] = Field(default=None, min_length=1, max_length=50)
    aircraft_reg: Optional[str] = Field(default=None, min_length=1, max_length=20)
    departure: Optional[str] = Field(default=None, min_length=1, max_length=10)
    arrival: Optional[str] = Field(default=None, min_length=1, max_length=10)
    departure_time: Optional[str] = None
    arrival_time: Optional[str] = None
    total_time: Optional[float] = Field(default=None, gt=0)
    sel_time: Optional[float] = Field(default=None, ge=0)
    ses_time: Optional[float] = Field(default=None, ge=0)
    mel_time: Optional[float] = Field(default=None, ge=0)
    mes_time: Optional[float] = Field(default=None, ge=0)
    helicopter_time: Optional[float] = Field(default=None, ge=0)
    glider_time: Optional[float] = Field(default=None, ge=0)
    solo_time: Optional[float] = Field(default=None, ge=0)
    pic_time: Optional[float] = Field(default=None, ge=0)
    sic_time: Optional[float] = Field(default=None, ge=0)
    dual_time: Optional[float] = Field(default=None, ge=0)
    instructor_time: Optional[float] = Field(default=None, ge=0)
    xcountry_time: Optional[float] = Field(default=None, ge=0)
    night_time: Optional[float] = Field(default=None, ge=0)
    act_instrument_time: Optional[float] = Field(default=None, ge=0)
    sim_instrument_time: Optional[float] = Field(default=None, ge=0)
    sim_time: Optional[float] = Field(default=None, ge=0)
    pilot_in_command: Optional[str] = Field(default=None, min_length=1, max_length=100)
    remarks: Optional[str] = None
    takeoffs_day: Optional[int] = Field(default=None, ge=0)
    takeoffs_night: Optional[int] = Field(default=None, ge=0)
    landings_day: Optional[int] = Field(default=None, ge=0)
    landings_night: Optional[int] = Field(default=None, ge=0)
    precision_approaches: Optional[int] = Field(default=None, ge=0)
    non_precision_approaches: Optional[int] = Field(default=None, ge=0)
    holding_patterns: Optional[int] = Field(default=None, ge=0)


class FlightResponse(BaseModel):
    """Schema for returning flight data from the API.

    This mirrors the ``flights`` database table columns and is used
    as the response model for all flight CRUD endpoints.

    ``from_attributes = True`` enables Pydantic v2's ORM mode so that
    we can pass a ``sqlite3.Row`` directly and have it converted.
    """
    id: int
    date: str
    aircraft_type: str
    aircraft_reg: str
    departure: str
    arrival: str
    departure_time: Optional[str] = None
    arrival_time: Optional[str] = None
    total_time: float
    sel_time: float = 0
    ses_time: float = 0
    mel_time: float = 0
    mes_time: float = 0
    helicopter_time: float = 0
    glider_time: float = 0
    solo_time: float = 0
    pic_time: float = 0
    sic_time: float = 0
    dual_time: float = 0
    instructor_time: float = 0
    xcountry_time: float = 0
    night_time: float = 0
    act_instrument_time: float = 0
    sim_instrument_time: float = 0
    sim_time: float = 0
    pilot_in_command: str
    remarks: Optional[str] = None
    takeoffs_day: int = 0
    takeoffs_night: int = 0
    landings_day: int = 0
    landings_night: int = 0
    precision_approaches: int = 0
    non_precision_approaches: int = 0
    holding_patterns: int = 0
    created_at: str

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    """Aggregated statistics for the Dashboard overview.

    Computed server-side from the authenticated user's flight data
    to avoid sending all flight records to the client just for stats.
    """
    total_flights: int
    total_hours: float
    total_night_hours: float
    hours_last_30_days: float
    total_landings: int
    unique_aircraft: int


# ── User / Auth Schemas ──

class UserCreate(BaseModel):
    """Schema for creating a new user account."""
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=6)


class UserUpdateUsername(BaseModel):
    """Schema for updating the username."""
    username: str = Field(..., min_length=1, max_length=50)


class UserChangePassword(BaseModel):
    """Schema for changing the password (requires current password for verification)."""
    current_password: str
    new_password: str = Field(..., min_length=6)


class UserResponse(BaseModel):
    """Schema for returning user data — safe variant that excludes the password hash."""
    id: int
    username: str

    class Config:
        from_attributes = True

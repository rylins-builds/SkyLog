"""Pydantic schemas for SkyLog flight data."""

from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class FlightCreate(BaseModel):
    """Schema for creating a new flight entry."""
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
    cross_country: Optional[bool] = Field(default=False)


class FlightUpdate(BaseModel):
    """Schema for updating an existing flight entry (all fields optional)."""
    date: Optional[date] = Field(default=None) 
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
    cross_country: Optional[bool] = None


class FlightResponse(BaseModel):
    """Schema for returning flight data."""
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
    cross_country: bool = False
    created_at: str

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    """Schema for dashboard statistics."""
    total_flights: int
    total_hours: float
    total_night_hours: float
    hours_last_30_days: float
    total_landings: int
    unique_aircraft: int

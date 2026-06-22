"""Flight CRUD API routes."""

from typing import List
from fastapi import APIRouter, HTTPException

from app.database import get_connection
from app.schemas import FlightCreate, FlightUpdate, FlightResponse, DashboardStats

router = APIRouter()


def row_to_flight_response(row) -> dict:
    """Convert a sqlite3.Row to a dict for FlightResponse."""
    return {
        "id": row["id"],
        "date": row["date"],
        "aircraft_type": row["aircraft_type"],
        "aircraft_reg": row["aircraft_reg"],
        "departure": row["departure"],
        "arrival": row["arrival"],
        "departure_time": row["departure_time"],
        "arrival_time": row["arrival_time"],
        "total_time": row["total_time"],
        "sel_time": row["sel_time"],
        "ses_time": row["ses_time"],
        "mel_time": row["mel_time"],
        "mes_time": row["mes_time"],
        "helicopter_time": row["helicopter_time"],
        "glider_time": row["glider_time"],
        "pic_time": row["pic_time"],
        "sic_time": row["sic_time"],
        "dual_time": row["dual_time"],
        "instructor_time": row["instructor_time"],
        "xcountry_time": row["xcountry_time"],
        "night_time": row["night_time"],
        "act_instrument_time": row["act_instrument_time"],
        "sim_instrument_time": row["sim_instrument_time"],
        "sim_time": row["sim_time"],
        "pilot_in_command": row["pilot_in_command"],
        "remarks": row["remarks"],
        "takeoffs_day": row["takeoffs_day"],
        "takeoffs_night": row["takeoffs_night"],
        "landings_day": row["landings_day"],
        "landings_night": row["landings_night"],
        "cross_country": bool(row["cross_country"]),
        "created_at": row["created_at"],
    }


@router.get("/flights", response_model=List[FlightResponse])
async def list_flights():
    """Get all flight entries, ordered by date descending."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM flights ORDER BY date DESC, id DESC"
        ).fetchall()
        return [row_to_flight_response(r) for r in rows]
    finally:
        conn.close()


@router.get("/flights/{flight_id}", response_model=FlightResponse)
async def get_flight(flight_id: int):
    """Get a single flight entry by ID."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM flights WHERE id = ?", (flight_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Flight not found")
        return row_to_flight_response(row)
    finally:
        conn.close()


@router.post("/flights", response_model=FlightResponse, status_code=201)
async def create_flight(flight: FlightCreate):
    """Create a new flight entry."""
    conn = get_connection()
    try:
        cursor = conn.execute(
            """INSERT INTO flights 
               (date, aircraft_type, aircraft_reg, departure, arrival, 
                departure_time, arrival_time, total_time, sel_time, ses_time, mel_time, mes_time, 
                helicopter_time, glider_time, pic_time, sic_time, dual_time, instructor_time, 
                xcountry_time, night_time, act_instrument_time, sim_instrument_time, sim_time, 
                pilot_in_command, remarks, takeoffs_day, takeoffs_night, landings_day, 
                landings_night, cross_country)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                flight.date.isoformat(),
                flight.aircraft_type,
                flight.aircraft_reg,
                flight.departure,
                flight.arrival,
                flight.departure_time,
                flight.arrival_time,
                flight.total_time,
                flight.sel_time,
                flight.ses_time,
                flight.mel_time,
                flight.mes_time,
                flight.helicopter_time,
                flight.glider_time,
                flight.pic_time,
                flight.sic_time,
                flight.dual_time,
                flight.instructor_time,
                flight.xcountry_time,
                flight.night_time or 0,
                flight.act_instrument_time,
                flight.sim_instrument_time,
                flight.sim_time,
                flight.pilot_in_command,
                flight.remarks,
                flight.takeoffs_day or 0,
                flight.takeoffs_night or 0,
                flight.landings_day or 0,
                flight.landings_night or 0,
                1 if flight.cross_country else 0,
            ),
        )
        conn.commit()
        flight_id = cursor.lastrowid
        row = conn.execute(
            "SELECT * FROM flights WHERE id = ?", (flight_id,)
        ).fetchone()
        return row_to_flight_response(row)
    finally:
        conn.close()


@router.put("/flights/{flight_id}", response_model=FlightResponse)
async def update_flight(flight_id: int, flight: FlightUpdate):
    """Update an existing flight entry."""
    conn = get_connection()
    try:
        # Check flight exists
        existing = conn.execute(
            "SELECT * FROM flights WHERE id = ?", (flight_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Flight not found")

        # Build update fields dynamically using model_fields_set so that fields
        # omitted from the request payload are never touched, even if they
        # default to None on the Pydantic model.
        updates = {}
        for field in flight.model_fields_set:
            value = getattr(flight, field)
            if field == "date" and value is not None:
                updates["date"] = value.isoformat()
            elif field == "cross_country":
                updates["cross_country"] = 1 if value else 0
            else:
                updates[field] = value

        if not updates:
            return row_to_flight_response(existing)

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values())
        values.append(flight_id)

        conn.execute(
            f"UPDATE flights SET {set_clause} WHERE id = ?", values
        )
        conn.commit()

        row = conn.execute(
            "SELECT * FROM flights WHERE id = ?", (flight_id,)
        ).fetchone()
        return row_to_flight_response(row)
    finally:
        conn.close()


@router.delete("/flights/{flight_id}", status_code=204)
async def delete_flight(flight_id: int):
    """Delete a flight entry."""
    conn = get_connection()
    try:
        cursor = conn.execute(
            "DELETE FROM flights WHERE id = ?", (flight_id,)
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Flight not found")
    finally:
        conn.close()


@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    """Get aggregated dashboard statistics."""
    conn = get_connection()
    try:
        total_flights = conn.execute(
            "SELECT COUNT(*) FROM flights"
        ).fetchone()[0]

        total_hours = conn.execute(
            "SELECT COALESCE(SUM(total_time), 0) FROM flights"
        ).fetchone()[0]

        total_night_hours = conn.execute(
            "SELECT COALESCE(SUM(night_time), 0) FROM flights"
        ).fetchone()[0]

        hours_last_30_days = conn.execute(
            """SELECT COALESCE(SUM(total_time), 0) FROM flights 
               WHERE date >= date('now', '-30 days')"""
        ).fetchone()[0]

        total_landings = conn.execute(
            "SELECT COALESCE(SUM(landings_day + landings_night), 0) FROM flights"
        ).fetchone()[0]

        unique_aircraft = conn.execute(
            "SELECT COUNT(DISTINCT aircraft_reg) FROM flights"
        ).fetchone()[0]

        return DashboardStats(
            total_flights=total_flights,
            total_hours=round(total_hours, 2),
            total_night_hours=round(total_night_hours, 2),
            hours_last_30_days=round(hours_last_30_days, 2),
            total_landings=total_landings,
            unique_aircraft=unique_aircraft,
        )
    finally:
        conn.close()

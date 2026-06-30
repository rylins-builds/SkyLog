"""Flight CRUD API routes — scoped to authenticated user."""

from typing import List
from fastapi import APIRouter, HTTPException, Header

from app.database import get_connection
from app.schemas import FlightCreate, FlightUpdate, FlightResponse, DashboardStats

router = APIRouter()


def _get_user_id(authorization: str) -> int:
    """Extract user_id from Authorization header. Raises 401 if invalid."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    token = authorization.replace("Bearer ", "").strip()
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT user_id FROM sessions WHERE token = ?", (token,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return row["user_id"]
    finally:
        conn.close()


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
        "solo_time": row["solo_time"],
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
        "precision_approaches": row["precision_approaches"],
        "non_precision_approaches": row["non_precision_approaches"],
        "holding_patterns": row["holding_patterns"],
        "created_at": row["created_at"],
    }


@router.get("/flights", response_model=List[FlightResponse])
async def list_flights(authorization: str = Header(None)):
    """Get all flight entries for the authenticated user, ordered by date descending."""
    user_id = _get_user_id(authorization)
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM flights WHERE user_id = ? ORDER BY date DESC, id DESC",
            (user_id,),
        ).fetchall()
        return [row_to_flight_response(r) for r in rows]
    finally:
        conn.close()


@router.get("/flights/{flight_id}", response_model=FlightResponse)
async def get_flight(flight_id: int, authorization: str = Header(None)):
    """Get a single flight entry by ID (must belong to the authenticated user)."""
    user_id = _get_user_id(authorization)
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM flights WHERE id = ? AND user_id = ?", (flight_id, user_id)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Flight not found")
        return row_to_flight_response(row)
    finally:
        conn.close()


@router.post("/flights", response_model=FlightResponse, status_code=201)
async def create_flight(flight: FlightCreate, authorization: str = Header(None)):
    """Create a new flight entry for the authenticated user."""
    user_id = _get_user_id(authorization)
    conn = get_connection()
    try:
        cursor = conn.execute(
            """INSERT INTO flights 
               (user_id, date, aircraft_type, aircraft_reg, departure, arrival, 
                departure_time, arrival_time, total_time, sel_time, ses_time, mel_time, mes_time, 
                helicopter_time, glider_time, solo_time, pic_time, sic_time, dual_time, instructor_time, 
                xcountry_time, night_time, act_instrument_time, sim_instrument_time, sim_time, 
                pilot_in_command, remarks, takeoffs_day, takeoffs_night, landings_day, 
                landings_night, precision_approaches, non_precision_approaches, holding_patterns)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id,
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
                flight.solo_time,
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
                flight.precision_approaches or 0,
                flight.non_precision_approaches or 0,
                flight.holding_patterns or 0,
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
async def update_flight(flight_id: int, flight: FlightUpdate, authorization: str = Header(None)):
    """Update an existing flight entry (must belong to the authenticated user)."""
    user_id = _get_user_id(authorization)
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT * FROM flights WHERE id = ? AND user_id = ?", (flight_id, user_id)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Flight not found")

        updates = {}
        for field in flight.model_fields_set:
            value = getattr(flight, field)
            if field == "date" and value is not None:
                updates["date"] = value.isoformat()
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
async def delete_flight(flight_id: int, authorization: str = Header(None)):
    """Delete a flight entry (must belong to the authenticated user)."""
    user_id = _get_user_id(authorization)
    conn = get_connection()
    try:
        cursor = conn.execute(
            "DELETE FROM flights WHERE id = ? AND user_id = ?", (flight_id, user_id)
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Flight not found")
    finally:
        conn.close()


@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(authorization: str = Header(None)):
    """Get aggregated dashboard statistics for the authenticated user."""
    user_id = _get_user_id(authorization)
    conn = get_connection()
    try:
        total_flights = conn.execute(
            "SELECT COUNT(*) FROM flights WHERE user_id = ?", (user_id,)
        ).fetchone()[0]

        total_hours = conn.execute(
            "SELECT COALESCE(SUM(total_time), 0) FROM flights WHERE user_id = ?", (user_id,)
        ).fetchone()[0]

        total_night_hours = conn.execute(
            "SELECT COALESCE(SUM(night_time), 0) FROM flights WHERE user_id = ?", (user_id,)
        ).fetchone()[0]

        hours_last_30_days = conn.execute(
            """SELECT COALESCE(SUM(total_time), 0) FROM flights 
               WHERE user_id = ? AND date >= date('now', '-30 days')""",
            (user_id,),
        ).fetchone()[0]

        total_landings = conn.execute(
            "SELECT COALESCE(SUM(landings_day + landings_night), 0) FROM flights WHERE user_id = ?",
            (user_id,),
        ).fetchone()[0]

        unique_aircraft = conn.execute(
            "SELECT COUNT(DISTINCT aircraft_reg) FROM flights WHERE user_id = ?",
            (user_id,),
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

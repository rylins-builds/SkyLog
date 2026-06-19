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
        "pic_time": row["pic_time"],
        "sic_time": row["sic_time"],
        "dual_time": row["dual_time"],
        "instructor_time": row["instructor_time"],
        "xcountry_time": row["xcountry_time"],
        "night_time": row["night_time"],
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
                departure_time, arrival_time, total_time, pic_time, sic_time, dual_time, 
                instructor_time, xcountrty_time, night_time, pilot_in_command, remarks, 
                takeoffs_day, takeoffs_night, landings_day, landings_night, cross_country)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                flight.date.isoformat(),
                flight.aircraft_type,
                flight.aircraft_reg,
                flight.departure,
                flight.arrival,
                flight.departure_time,
                flight.arrival_time,
                flight.total_time,
                flight.pic_time,
                flight.sic_time,
                flight.dual_time,
                flight.instructor_time,
                flight.xcountry_time,
                flight.night_time or 0,
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

        # Build update fields dynamically (only non-None fields)
        updates = {}
        if flight.date is not None:
            updates["date"] = flight.date.isoformat()
        if flight.aircraft_type is not None:
            updates["aircraft_type"] = flight.aircraft_type
        if flight.aircraft_reg is not None:
            updates["aircraft_reg"] = flight.aircraft_reg
        if flight.departure is not None:
            updates["departure"] = flight.departure
        if flight.arrival is not None:
            updates["arrival"] = flight.arrival
        if flight.departure_time is not None:
            updates["departure_time"] = flight.departure_time
        if flight.arrival_time is not None:
            updates["arrival_time"] = flight.arrival_time
        if flight.total_time is not None:
            updates["total_time"] = flight.total_time
        if flight.pic_time is not None:
            updates["pic_time"] = flight.pic_time
        if flight.sic_time is not None:
            updates["sic_time"] = flight.sic_time
        if flight.dual_time is not None:
            updates["dual_time"] = flight.dual_time
        if flight.instructor_time is not None:
            updates["instructor_time"] = flight.instructor_time
        if flight.xcountry_time is not None:
            updates["xcountry_time"] = flight.xcountry_time
        if flight.night_time is not None:
            updates["night_time"] = flight.night_time
        if flight.pilot_in_command is not None:
            updates["pilot_in_command"] = flight.pilot_in_command
        if flight.remarks is not None:
            updates["remarks"] = flight.remarks
        if flight.takeoffs_day is not None:
            updates["takeoffs_day"] = flight.takeoffs_day
        if flight.takeoffs_night is not None:
            updates["takeoffs_night"] = flight.takeoffs_night
        if flight.landings_day is not None:
            updates["landings_day"] = flight.landings_day
        if flight.landings_night is not None:
            updates["landings_night"] = flight.landings_night
        if flight.cross_country is not None:
            updates["cross_country"] = 1 if flight.cross_country else 0

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

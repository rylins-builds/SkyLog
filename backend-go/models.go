package main

import "time"

// Flight represents a complete flight log record.
// Field names use snake_case JSON tags to match the Python backend's Pydantic output.
type Flight struct {
	ID                    int     `json:"id"`
	UserID                int     `json:"-"`
	Date                  string  `json:"date"`
	PilotInCommand        string  `json:"pilot_in_command"`
	AircraftType          string  `json:"aircraft_type"`
	AircraftReg           string  `json:"aircraft_reg"`
	Departure             string  `json:"departure"`
	Arrival               string  `json:"arrival"`
	DepartureTime         *string `json:"departure_time"`
	ArrivalTime           *string `json:"arrival_time"`
	TotalTime             float64 `json:"total_time"`
	SELTime               float64 `json:"sel_time"`
	SESTime               float64 `json:"ses_time"`
	MELTime               float64 `json:"mel_time"`
	MESTime               float64 `json:"mes_time"`
	HelicopterTime        float64 `json:"helicopter_time"`
	GyroplaneTime         float64 `json:"gyroplane_time"`
	PoweredLiftTime       float64 `json:"powered_lift_time"`
	GliderTime            float64 `json:"glider_time"`
	BalloonTime           float64 `json:"balloon_time"`
	AirshipTime           float64 `json:"airship_time"`
	SoloTime              float64 `json:"solo_time"`
	PICTime               float64 `json:"pic_time"`
	SICTime               float64 `json:"sic_time"`
	DualTime              float64 `json:"dual_time"`
	InstructorTime        float64 `json:"instructor_time"`
	XCountryTime          float64 `json:"xcountry_time"`
	NightTime             float64 `json:"night_time"`
	ActInstrumentTime     float64 `json:"act_instrument_time"`
	SimInstrumentTime     float64 `json:"sim_instrument_time"`
	FullFlightSimulatorTime float64 `json:"full_flight_simulator_time"`
	FlightTrainingDeviceTime float64 `json:"flight_training_device_time"`
	AviationTrainingDeviceTime float64 `json:"aviation_training_device_time"`
	
	
	TakeoffsDay           int     `json:"takeoffs_day"`
	TakeoffsNight         int     `json:"takeoffs_night"`
	LandingsDay           int     `json:"landings_day"`
	LandingsNight         int     `json:"landings_night"`
	PrecisionApproaches   int     `json:"precision_approaches"`
	NonPrecisionApproaches int    `json:"non_precision_approaches"`
	HoldingPatterns       int     `json:"holding_patterns"`
	LaunchType            *string `json:"launch_type"`
	Remarks               *string `json:"remarks"`
	CreatedAt             string  `json:"created_at"`
}

// FlightCreate is the request body for POST /api/flights.
type FlightCreate struct {
	Date                  string  `json:"date"`
	PilotInCommand        string  `json:"pilot_in_command"`
	AircraftType          string  `json:"aircraft_type"`
	AircraftReg           string  `json:"aircraft_reg"`
	Departure             string  `json:"departure"`
	Arrival               string  `json:"arrival"`
	DepartureTime         *string `json:"departure_time"`
	ArrivalTime           *string `json:"arrival_time"`
	TotalTime             float64 `json:"total_time"`
	SELTime               float64 `json:"sel_time"`
	SESTime               float64 `json:"ses_time"`
	MELTime               float64 `json:"mel_time"`
	MESTime               float64 `json:"mes_time"`
	HelicopterTime        float64 `json:"helicopter_time"`
	GyroplaneTime         float64 `json:"gyroplane_time"`
	PoweredLiftTime       float64 `json:"powered_lift_time"`
	GliderTime            float64 `json:"glider_time"`
	BalloonTime           float64 `json:"balloon_time"`
	AirshipTime           float64 `json:"airship_time"`
	SoloTime              float64 `json:"solo_time"`
	PICTime               float64 `json:"pic_time"`
	SICTime               float64 `json:"sic_time"`
	DualTime              float64 `json:"dual_time"`
	InstructorTime        float64 `json:"instructor_time"`
	XCountryTime          float64 `json:"xcountry_time"`
	NightTime             float64 `json:"night_time"`
	ActInstrumentTime     float64 `json:"act_instrument_time"`
	SimInstrumentTime     float64 `json:"sim_instrument_time"`
	FullFlightSimulatorTime float64 `json:"full_flight_simulator_time"`
	FlightTrainingDeviceTime float64 `json:"flight_training_device_time"`
	AviationTrainingDeviceTime float64 `json:"aviation_training_device_time"`
	
	
	TakeoffsDay           int     `json:"takeoffs_day"`
	TakeoffsNight         int     `json:"takeoffs_night"`
	LandingsDay           int     `json:"landings_day"`
	LandingsNight         int     `json:"landings_night"`
	PrecisionApproaches   int     `json:"precision_approaches"`
	NonPrecisionApproaches int    `json:"non_precision_approaches"`
	HoldingPatterns       int     `json:"holding_patterns"`
	LaunchType            *string `json:"launch_type"`
	Remarks               *string `json:"remarks"`
}

// FlightUpdate is the request body for PUT /api/flights/{id}.
// All fields are pointers so we can distinguish between "not provided" and "set to zero".
type FlightUpdate struct {
	Date                  *string  `json:"date"`
	PilotInCommand        *string  `json:"pilot_in_command"`
	AircraftType          *string  `json:"aircraft_type"`
	AircraftReg           *string  `json:"aircraft_reg"`
	Departure             *string  `json:"departure"`
	Arrival               *string  `json:"arrival"`
	DepartureTime         *string  `json:"departure_time"`
	ArrivalTime           *string  `json:"arrival_time"`
	TotalTime             *float64 `json:"total_time"`
	SELTime               *float64 `json:"sel_time"`
	SESTime               *float64 `json:"ses_time"`
	MELTime               *float64 `json:"mel_time"`
	MESTime               *float64 `json:"mes_time"`
	HelicopterTime        *float64 `json:"helicopter_time"`
	GyroplaneTime         *float64 `json:"gyroplane_time"`
	PoweredLiftTime       *float64 `json:"powered_lift_time"`
	GliderTime            *float64 `json:"glider_time"`
	BalloonTime           *float64 `json:"balloon_time"`
	AirshipTime           *float64 `json:"airship_time"`
	SoloTime              *float64 `json:"solo_time"`
	PICTime               *float64 `json:"pic_time"`
	SICTime               *float64 `json:"sic_time"`
	DualTime              *float64 `json:"dual_time"`
	InstructorTime        *float64 `json:"instructor_time"`
	XCountryTime          *float64 `json:"xcountry_time"`
	NightTime             *float64 `json:"night_time"`
	ActInstrumentTime     *float64 `json:"act_instrument_time"`
	SimInstrumentTime     *float64 `json:"sim_instrument_time"`
	FullFlightSimulatorTime *float64 `json:"full_flight_simulator_time"`
	FlightTrainingDeviceTime *float64 `json:"flight_training_device_time"`
	AviationTrainingDeviceTime *float64 `json:"aviation_training_device_time"`
	
	
	TakeoffsDay           *int     `json:"takeoffs_day"`
	TakeoffsNight         *int     `json:"takeoffs_night"`
	LandingsDay           *int     `json:"landings_day"`
	LandingsNight         *int     `json:"landings_night"`
	PrecisionApproaches   *int     `json:"precision_approaches"`
	NonPrecisionApproaches *int    `json:"non_precision_approaches"`
	HoldingPatterns       *int     `json:"holding_patterns"`
	LaunchType            *string `json:"launch_type"`
	Remarks               *string  `json:"remarks"`
}

// DashboardStats is aggregated flight statistics.
type DashboardStats struct {
	TotalFlights             int     `json:"total_flights"`
	TotalHours               float64 `json:"total_hours"`
	TotalNightHours          float64 `json:"total_night_hours"`
	HoursLast30Days          float64 `json:"hours_last_30_days"`
	TotalLandings            int     `json:"total_landings"`
	UniqueAircraft           int     `json:"unique_aircraft"`
	SELTime                  float64 `json:"sel_time"`
	SESTime                  float64 `json:"ses_time"`
	MELTime                  float64 `json:"mel_time"`
	MESTime                  float64 `json:"mes_time"`
	HelicopterTime           float64 `json:"helicopter_time"`
	GyroplaneTime            float64 `json:"gyroplane_time"`
	PoweredLiftTime          float64 `json:"powered_lift_time"`
	GliderTime               float64 `json:"glider_time"`
	BalloonTime              float64 `json:"balloon_time"`
	AirshipTime              float64 `json:"airship_time"`
	SoloTime                 float64 `json:"solo_time"`
	PICTime                  float64 `json:"pic_time"`
	SICTime                  float64 `json:"sic_time"`
	DualTime                 float64 `json:"dual_time"`
	InstructorTime           float64 `json:"instructor_time"`
	XCountryTime             float64 `json:"xcountry_time"`
	ActInstrumentTime        float64 `json:"act_instrument_time"`
	SimInstrumentTime        float64 `json:"sim_instrument_time"`
	FullFlightSimulatorTime  float64 `json:"full_flight_simulator_time"`
	FlightTrainingDeviceTime float64 `json:"flight_training_device_time"`
	AviationTrainingDeviceTime float64 `json:"aviation_training_device_time"`
	TakeoffsDay              int     `json:"takeoffs_day"`
	TakeoffsNight            int     `json:"takeoffs_night"`
	LandingsDay              int     `json:"landings_day"`
	LandingsNight            int     `json:"landings_night"`
	PrecisionApproaches      int     `json:"precision_approaches"`
	NonPrecisionApproaches   int     `json:"non_precision_approaches"`
	HoldingPatterns          int     `json:"holding_patterns"`
}

// AircraftTypeStat holds aggregated stats for a single aircraft type.
type AircraftTypeStat struct {
	AircraftType          string  `json:"aircraft_type"`
	TotalHours            float64 `json:"total_hours"`
	FlightCount           int     `json:"flight_count"`
	DaysSinceLastFlight   float64 `json:"days_since_last_flight"`
	SELTime               float64 `json:"sel_time"`
	SESTime               float64 `json:"ses_time"`
	MELTime               float64 `json:"mel_time"`
	MESTime               float64 `json:"mes_time"`
	HelicopterTime        float64 `json:"helicopter_time"`
	GyroplaneTime         float64 `json:"gyroplane_time"`
	PoweredLiftTime       float64 `json:"powered_lift_time"`
	GliderTime            float64 `json:"glider_time"`
	BalloonTime           float64 `json:"balloon_time"`
	AirshipTime           float64 `json:"airship_time"`
	SoloTime              float64 `json:"solo_time"`
	PICTime               float64 `json:"pic_time"`
	SICTime               float64 `json:"sic_time"`
	DualTime              float64 `json:"dual_time"`
	InstructorTime        float64 `json:"instructor_time"`
	XCountryTime          float64 `json:"xcountry_time"`
	NightTime             float64 `json:"night_time"`
	ActInstrumentTime     float64 `json:"act_instrument_time"`
	SimInstrumentTime     float64 `json:"sim_instrument_time"`
	FullFlightSimulatorTime float64 `json:"full_flight_simulator_time"`
	FlightTrainingDeviceTime float64 `json:"flight_training_device_time"`
	AviationTrainingDeviceTime float64 `json:"aviation_training_device_time"`
	TakeoffsDay           int     `json:"takeoffs_day"`
	TakeoffsNight         int     `json:"takeoffs_night"`
	LandingsDay           int     `json:"landings_day"`
	LandingsNight         int     `json:"landings_night"`
	PrecisionApproaches   int     `json:"precision_approaches"`
	NonPrecisionApproaches int    `json:"non_precision_approaches"`
	HoldingPatterns       int     `json:"holding_patterns"`
}

// Attachment represents a file attached to a flight log entry.
type Attachment struct {
	ID          int    `json:"id"`
	FlightID    int    `json:"flight_id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
	CreatedAt   string `json:"created_at"`
}

// LoginRequest is the body for POST /api/auth/login.
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// RegisterRequest is the body for POST /api/auth/create-user.
type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// TokenResponse is returned by login, create-user, and auto-login.
type TokenResponse struct {
	Token    string `json:"token"`
	Username string `json:"username"`
}

// MultiUserModeRequest is the body for PUT /api/auth/multi-user-mode.
type MultiUserModeRequest struct {
	Enabled  bool    `json:"enabled"`
	Password *string `json:"password"`
}

// UsernameUpdate is the body for PUT /api/settings/username.
type UsernameUpdate struct {
	Username string `json:"username"`
}

// PasswordUpdate is the body for PUT /api/settings/password.
type PasswordUpdate struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// VisibilitySaveRequest is the body for PUT /api/settings/visibility.
type VisibilitySaveRequest struct {
	PageVisibility   string `json:"page_visibility"`
	ColumnVisibility string `json:"column_visibility"`
}

// CurrencyThresholdEntry is a single threshold in a batch save.
type CurrencyThresholdEntry struct {
	CategoryID string `json:"category_id"`
	MinCount   int    `json:"min_count"`
	DaysWindow int    `json:"days_window"`
}

// CurrencyThresholdsSaveRequest is the body for PUT /api/currency/thresholds.
type CurrencyThresholdsSaveRequest struct {
	Thresholds []CurrencyThresholdEntry `json:"thresholds"`
}

// CurrencyThresholdResponse is the value shape inside the thresholds map.
type CurrencyThresholdResponse struct {
	MinCount   int `json:"minCount"`
	DaysWindow int `json:"daysWindow"`
}

// DashboardLayoutTile represents a single tile in the user's dashboard layout.
type DashboardLayoutTile struct {
	Type   string `json:"type"`
	Width  int    `json:"width"`
	Order  int    `json:"order"`
}

// DashboardLayoutResponse is returned by GET /api/settings/dashboard-layout.
type DashboardLayoutResponse struct {
	Layout []DashboardLayoutTile `json:"layout"`
}

// DashboardLayoutSaveRequest is the body for PUT /api/settings/dashboard-layout.
type DashboardLayoutSaveRequest struct {
	Layout []DashboardLayoutTile `json:"layout"`
}

// Validate checks required fields and value constraints for FlightCreate.
func (f *FlightCreate) Validate() map[string]string {
	errs := make(map[string]string)
	if f.Date == "" {
		errs["date"] = "Date is required"
	} else {
		if _, err := time.Parse("2006-01-02", f.Date); err != nil {
			errs["date"] = "Invalid date format, expected YYYY-MM-DD"
		}
	}
	if f.AircraftType == "" {
		errs["aircraft_type"] = "Aircraft type is required"
	}
	if f.AircraftReg == "" {
		errs["aircraft_reg"] = "Registration is required"
	}
	if f.Departure == "" {
		errs["departure"] = "Departure is required"
	}
	if f.Arrival == "" {
		errs["arrival"] = "Arrival is required"
	}
	if f.TotalTime <= 0 {
		errs["total_time"] = "Total time must be greater than 0"
	}
	if (f.GliderTime > 0 || f.BalloonTime > 0 || f.AirshipTime > 0) && (f.LaunchType == nil || *f.LaunchType == "") {
		errs["launch_type"] = "Launch type is required for glider or lighter-than-air flights"
	}
	if f.LaunchType != nil && *f.LaunchType != "" {
		valid := *f.LaunchType == "aero_tow" || *f.LaunchType == "ground_launch" || *f.LaunchType == "powered_launch"
		if !valid {
			errs["launch_type"] = "Launch type must be aero_tow, ground_launch, or powered_launch"
		}
	}
	return errs
}

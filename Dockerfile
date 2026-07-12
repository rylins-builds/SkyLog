# ── Frontend build ──
FROM alpine:latest AS frontend-build

RUN apk add --no-cache nodejs npm

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Backend build ──
FROM alpine:latest AS backend-build

RUN apk add --no-cache go gcc musl-dev

WORKDIR /app
COPY backend-go/go.mod backend-go/go.sum ./
RUN go mod download
COPY backend-go/ .
RUN CGO_ENABLED=0 go build -o skylog .

# ── Runtime ──
FROM alpine:latest

WORKDIR /app
RUN mkdir -p /app/data /app/static

COPY --from=backend-build /app/skylog .
COPY --from=frontend-build /app/frontend/dist /app/static

EXPOSE 3000

ENV PORT=3000

CMD ["./skylog"]

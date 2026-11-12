FROM golang:1.22-alpine AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -mod=vendor -trimpath -ldflags="-s -w" -o /out/api .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D -u 10001 app
WORKDIR /app
COPY --from=build /out/api /app/api
RUN mkdir -p /data/storage && chown -R app:app /data
USER app
ENV STORAGE_DIR=/data/storage
EXPOSE 8080
ENTRYPOINT ["/app/api"]

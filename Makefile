.PHONY: all build-frontend build-backend run dev clean

all: build-frontend build-backend

build-frontend:
	cd frontend && npm install && npm run build
	rm -rf backend/public
	cp -r frontend/build backend/public

build-backend:
	cd backend && go build -o kiroshi .

run: build-frontend build-backend
	cd backend && ./kiroshi

dev-backend:
	cd backend && go run .

clean:
	rm -rf frontend/build frontend/.svelte-kit
	rm -rf backend/public
	rm -f backend/kiroshi

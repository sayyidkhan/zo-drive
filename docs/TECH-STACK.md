# TECH-STACK.md

# Zo Drive

> Technical architecture and implementation decisions.

Version: v0.1

---

# Philosophy

Zo Drive is intentionally built as a thin layer over Zo Object Storage.

It demonstrates how quickly developers can build production-ready applications using Zo.

The application exposes the same backend through multiple clients:

- Web Application
- CLI
- Future SDKs

Everything communicates through a single REST API.

---

# High Level Architecture

                        Zo Drive

          Web GUI              CLI

                \             /

                 REST API

                     |

                Zo Object Storage

There is no separate file server.

There is no custom storage engine.

Zo Storage is the storage engine.

---

# Technology Stack

## Frontend

Framework

- React 19

Language

- TypeScript

Bundler

- Vite

Styling

- Tailwind CSS

UI Components

- shadcn/ui

State Management

- Zustand

Server State

- TanStack Query

Icons

- Lucide

Notifications

- Sonner

File Upload

- Native Browser APIs

---

# Backend

Framework

- Hono

Language

- TypeScript

Validation

- Zod

Authentication

- Better Auth

API Style

- REST

---

# Storage

Primary Storage

- Zo Object Storage

Every uploaded object is stored directly inside Zo Storage.

No local filesystem.

No intermediate storage.

---

# Metadata

For Hackathon MVP

None.

The storage bucket becomes the source of truth.

Future versions may introduce metadata services.

---

# Deployment

Everything deployed on Zo.

```
Browser

↓

Zo Static Hosting

↓

Hono API

↓

Zo Object Storage
```

Single domain.

Single deployment.

Single platform.

---

# Monorepo Structure

```
zo-drive/

apps/
    web/
    api/
    cli/

packages/
    sdk/
    types/

docs/
```

---

# apps/web

Purpose

Browser application.

Responsibilities

- Login
- Upload
- Browse objects
- Download objects
- Delete objects
- Preview objects

---

# apps/api

Purpose

REST API.

Responsibilities

- Authentication
- Upload endpoint
- Download endpoint
- Delete endpoint
- List objects

The API never stores files.

It simply proxies requests to Zo Object Storage.

---

# apps/cli

Purpose

Developer interface.

Commands

```
zo login

zo upload file.pdf

zo ls

zo download image.png

zo delete image.png
```

Every CLI command calls the exact same REST API used by the frontend.

---

# packages/sdk

Purpose

Shared client.

Both the React frontend and CLI consume the same SDK.

Example

```ts
await zo.upload(file)

await zo.list()

await zo.download(key)

await zo.delete(key)
```

This avoids duplicate API logic.

---

# packages/types

Shared TypeScript types.

Example

- ObjectMetadata
- UploadResponse
- AuthResponse
- ErrorResponse

---

# REST API

Authentication

```
POST /auth/login
POST /auth/logout
GET  /auth/me
```

Storage

```
GET    /objects
POST   /objects
GET    /objects/:key
DELETE /objects/:key
```

Health

```
GET /health
```

---

# Upload Flow

Browser

↓

Select File

↓

REST API

↓

Zo Object Storage

↓

Return Object URL

---

# Download Flow

Browser

↓

REST API

↓

Zo Object Storage

↓

Stream Object

---

# Delete Flow

Browser

↓

REST API

↓

Zo Object Storage

↓

Object Deleted

---

# Preview Flow

Browser

↓

Request Object

↓

Determine MIME Type

↓

Render

Image

PDF

Audio

Video

Download

---

# Supported File Types

Images

- PNG
- JPG
- GIF
- WebP

Video

- MP4

Audio

- MP3
- WAV

Documents

- PDF

Everything else

- Download

---

# Security

Authentication

- Better Auth

Authorization

Every request belongs to a user.

Users cannot access another user's objects.

---

# Future

Version 2

- Object metadata
- Search
- Tags
- Sharing
- Public links
- AI search

Version 3

- Folder abstraction
- Sync
- Desktop App
- Mobile App

---

# Why Hono?

- Lightweight
- Fast
- TypeScript-first
- Web Standards API
- Excellent developer experience
- Perfect fit for REST APIs

---

# Why React?

- Large ecosystem
- Excellent developer experience
- Easy integration with shadcn/ui
- Familiar to most developers

---

# Why Vite?

- Extremely fast development
- Simple build pipeline
- No framework lock-in

---

# Why Zo Object Storage?

Zo Drive exists to showcase Zo.

The storage layer should therefore be Zo itself.

Every upload, download and delete operation demonstrates Zo Object Storage in production.

---

# Engineering Principles

- Single deployment
- Type-safe end-to-end
- One API
- Shared SDK
- Minimal abstraction
- Object Storage first
- Developer friendly

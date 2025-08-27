# Huiswerkcoach Anouk - PWA

Een Nederlandse huiswerkcoach Progressive Web App voor 5 havo leerlingen met voice interaction, AI-begeleiding en dagelijkse planning.

## Features

- 🎤 **Voice Check-ins**: Dagelijkse spraakopnames voor taakplanning (max 60s)
- 📝 **Taakbeheer**: Automatische taken aanmaken via AI, prioritering en voortgangtracking
- 📅 **Roosterbeheer**: Handmatige invoer van lessen en toetsen
- 🤖 **AI Uitleg**: "Ik snap dit niet" functionaliteit met OCR, stapsgewijze uitleg en quizzen
- 👨‍👩‍👧‍👦 **Parent Dashboard**: Readonly overzicht voor ouders
- ⏰ **Dagelijkse Reminders**: Automatische herinneringen via email
- 📱 **PWA**: Installeerbaar, offline-ready, mobile-first

## Tech Stack

### Frontend
- **React + Vite**: Modern build tooling
- **Wouter**: Lightweight routing
- **Shadcn UI + Tailwind CSS**: Component library en styling
- **TanStack Query**: Data fetching en caching
- **Supabase Auth**: Authenticatie

### Backend  
- **Express.js**: REST API server
- **Supabase/Neon Postgres**: Database via Drizzle ORM
- **OpenAI**: Whisper (ASR) + GPT-5 (planning/uitleg)
- **Azure TTS**: Nederlandse spraaksynthese
- **Google Vision**: OCR voor foto's/PDFs

## Setup & Installation

### 1. Kloon Repository
```bash
git clone <repository-url>
cd huiswerkcoach-anouk
npm install

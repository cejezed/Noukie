# Huiswerkcoach Anouk - PWA

## Overview

Huiswerkcoach Anouk is a Dutch Progressive Web App designed to help 5 havo students with homework planning and subject-specific tutoring. The application combines voice interaction with AI-powered assistance to provide daily check-ins, automated task planning, and step-by-step explanations for difficult topics. Students can record daily voice check-ins that get transcribed and converted into actionable tasks, while parents have read-only access to monitor progress and upcoming tests.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built as a Progressive Web App using React with Vite for modern build tooling. The application follows a mobile-first design approach using shadcn/ui components styled with Tailwind CSS. The routing is handled by Wouter, a lightweight routing library. TanStack Query manages data fetching and caching, providing a smooth user experience with offline capabilities through service workers.

The application is structured around four main tabs:
- **Vandaag (Today)**: Voice check-ins, priority tasks, and daily schedule
- **Planning**: Weekly task overview and completion tracking
- **Rooster (Schedule)**: Manual lesson and test entry
- **Help**: OCR-powered homework assistance with step-by-step explanations

### Backend Architecture
The backend is an Express.js REST API server that handles all business logic and external service integrations. The server follows a modular approach with separate services for different functionalities:

- **Voice Processing**: Audio transcription using OpenAI Whisper
- **Task Planning**: AI-powered task creation from voice transcripts using GPT-5
- **Content Understanding**: OCR processing via Google Vision API for homework help
- **Audio Generation**: Dutch text-to-speech using Azure TTS
- **Scheduled Tasks**: Cron jobs for daily reminder emails

### Data Storage
The application uses PostgreSQL as the primary database, accessed through Drizzle ORM for type-safe database operations. The database schema supports multiple user roles (student/parent), courses, schedules, tasks, and user sessions. The system is designed to work with either Supabase or Neon PostgreSQL providers.

Key database entities include:
- Users with role-based access (student/parent)
- Courses and schedule management
- Task tracking with priority and status
- Voice session transcripts and summaries
- Homework materials and quiz results

### Authentication and Authorization
Authentication is handled through Supabase Auth, providing secure email-based login with role differentiation between students and parents. The system maintains session state across the PWA and ensures parents have read-only access to their student's data.

### Voice Processing Pipeline
The voice interaction system processes user recordings through a multi-step pipeline:
1. Audio capture with WebRTC MediaRecorder API
2. Transcription via OpenAI Whisper
3. Task extraction using GPT-5 natural language processing
4. Automatic task creation and prioritization
5. Response generation with Dutch TTS audio feedback

### AI-Powered Help System
The homework assistance feature combines multiple AI services:
- OCR text extraction from photos/PDFs using Google Vision
- Subject matter recognition and explanation generation
- Step-by-step problem solving with examples
- Interactive quizzes to test understanding
- Audio explanations in Dutch using Azure TTS

## External Dependencies

### Core Services
- **Supabase**: Authentication and potentially database hosting
- **Neon**: PostgreSQL database provider (alternative to Supabase)
- **OpenAI**: Whisper for speech-to-text and GPT-5 for task planning and explanations
- **Azure Cognitive Services**: Text-to-speech for Dutch audio generation
- **Google Cloud Vision**: OCR processing for homework images and PDFs

### Development and Infrastructure
- **Drizzle ORM**: Type-safe database queries and migrations
- **Node-cron**: Scheduled task execution for daily reminders
- **Multer**: File upload handling for audio and image processing
- **React Query**: Client-side data fetching and state management

### Email Services
- Email provider integration (Postmark/SendGrid) for daily reminder notifications
- Configurable reminder timing through environment variables

### PWA Infrastructure
- Service Worker for offline functionality and caching
- Web App Manifest for installable app experience
- MediaRecorder API for voice recording capabilities
- File API for image/PDF uploads

The architecture prioritizes privacy, with all data processing happening through established service providers and no persistent audio storage beyond transcription needs.
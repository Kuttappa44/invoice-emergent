# AI Document Extraction and Matching Platform - PRD

## Original Problem Statement
Build a production-grade full-stack web application that processes documents received via email, extracts structured data using AI models, optionally matches the extracted data with external sources, and stores results in a configurable database.

## User Personas
1. **Finance Teams** - Process invoices, receipts, and purchase orders
2. **Operations Teams** - Handle vendor documents and compliance paperwork
3. **Enterprise Users** - Need scalable document processing at scale

## Core Requirements (Static)
- Three workflow modes: Extraction Only, Matching Only, Full Flow
- Three primary UI pages: Dashboard, Configurations, Workflow
- Template-driven extraction with AI field detection
- Configurable AI/Email/Storage/Database settings
- Real-time workflow logs
- Document review and approval workflow
- Export functionality (CSV)

## Tech Stack Implemented
- **Frontend**: React 19 + TailwindCSS + Shadcn/UI
- **Backend**: FastAPI + Python
- **Database**: MongoDB (via Motor async driver)
- **AI Extraction**: Gemini 2.5 Flash (via Emergent Integrations)
- **Storage**: Emergent Object Storage

## What's Been Implemented (Jan 2026)

### Dashboard Page ✅
- Stats cards: Total runs, Documents processed, Extractions, Matches, Flagged, Errors
- Area chart: Documents processed per day
- Pie chart: Success rate visualization
- Recent workflow runs table

### Configurations Page ✅
- Create/Edit/Delete configuration profiles
- AI Provider settings (OpenAI, Anthropic, Gemini, Azure)
- Email Provider settings (Gmail OAuth, IMAP)
- Storage configuration (Emergent Cloud, S3, GCS)
- Matching source and logic configuration

### Templates Page ✅
- Create/Edit/Delete extraction templates
- Upload sample document for AI field detection
- Manual field definition (name, type, required, active)
- Field types: text, number, date, currency

### Workflow Page ✅
- Step-by-step wizard (Config → Mode → Template → Filters)
- Three run modes: extraction_only, matching_only, full_flow
- Date range filters with calendar picker
- Email filters (sender, domain, subject)
- Live logs panel with real-time updates
- Document upload for manual processing
- Results table with extracted fields
- Document review modal (Approve/Reject/Flag)
- CSV export functionality

### Backend APIs ✅
- Full CRUD for configurations, templates, workflows, documents
- AI extraction using Gemini (file attachment support)
- Matching engine with multiple comparison methods
- SSE endpoint for real-time log streaming
- Document storage via Emergent Object Storage

### UI/UX ✅
- Dark/Light mode toggle
- Responsive design
- Loading skeletons
- Toast notifications (Sonner)
- All interactive elements have data-testid

## Prioritized Backlog

### P0 (Critical for Production)
- [x] Core dashboard with analytics
- [x] Configuration profiles CRUD
- [x] Template management with AI detection
- [x] Workflow execution wizard
- [x] Document extraction with AI
- [x] Document review workflow

### P1 (High Priority)
- [ ] Gmail OAuth integration (requires user credentials)
- [ ] IMAP email provider connection
- [ ] Batch email processing
- [ ] Advanced matching logic UI

### P2 (Nice to Have)
- [ ] User authentication
- [ ] Multi-user support with roles
- [ ] Webhook notifications
- [ ] Custom AI provider endpoints
- [ ] Excel/CSV matching source upload
- [ ] Document comparison view
- [ ] Audit logging

## Next Tasks
1. **Gmail OAuth Setup** - User needs to provide GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from Google Cloud Console
2. **Email Processing** - Connect to inbox and process emails with attachments
3. **Matching Source Upload** - Allow CSV/Excel file upload for matching data
4. **Advanced Matching UI** - Build UI for configuring matching rules per field

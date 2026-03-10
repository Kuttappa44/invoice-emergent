from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Query, Request
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import asyncio
import json
import base64
import requests
import tempfile
import aiofiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Emergent Storage
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "docextract"
storage_key = None

# Create the main app
app = FastAPI(title="Document Extraction Platform API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============= MODELS =============

class FieldDefinition(BaseModel):
    name: str
    field_type: str = "text"  # text, number, date, currency
    required: bool = False
    active: bool = True
    description: Optional[str] = None

class AIProviderConfig(BaseModel):
    provider_name: str = "openai"
    api_endpoint: Optional[str] = None
    api_key: Optional[str] = None
    model_name: str = "gpt-5o-mini"

class EmailProviderConfig(BaseModel):
    provider_type: str = "gmail"  # gmail, imap
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    use_ssl: bool = True
    oauth_connected: bool = False
    connected_email: Optional[str] = None

class StorageConfig(BaseModel):
    provider_name: str = "emergent"  # emergent, local
    bucket_name: Optional[str] = None
    folder_structure: str = "/{run-id}/{email-date}/{filename}"

class DatabaseConfig(BaseModel):
    db_type: str = "mongodb"  # mongodb, mysql, postgresql
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

class MatchingSourceConfig(BaseModel):
    source_type: str = "api"  # api, excel, csv, database
    connection_settings: Dict[str, Any] = {}
    field_mappings: Dict[str, str] = {}

class MatchingRule(BaseModel):
    field_name: str
    match_type: str = "exact"  # exact, case_insensitive, contains, fuzzy, numeric_tolerance, date_tolerance
    tolerance_value: Optional[float] = None
    priority: int = 1

class MatchingLogicConfig(BaseModel):
    matching_keys: List[str] = []
    rules: List[MatchingRule] = []

class ConfigurationProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    ai_provider: AIProviderConfig = Field(default_factory=AIProviderConfig)
    email_provider: EmailProviderConfig = Field(default_factory=EmailProviderConfig)
    storage_config: StorageConfig = Field(default_factory=StorageConfig)
    database_config: DatabaseConfig = Field(default_factory=DatabaseConfig)
    matching_source: MatchingSourceConfig = Field(default_factory=MatchingSourceConfig)
    matching_logic: MatchingLogicConfig = Field(default_factory=MatchingLogicConfig)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ConfigurationProfileCreate(BaseModel):
    name: str
    description: Optional[str] = None
    ai_provider: Optional[AIProviderConfig] = None
    email_provider: Optional[EmailProviderConfig] = None
    storage_config: Optional[StorageConfig] = None
    database_config: Optional[DatabaseConfig] = None
    matching_source: Optional[MatchingSourceConfig] = None
    matching_logic: Optional[MatchingLogicConfig] = None

class Template(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    sample_document_path: Optional[str] = None
    sample_document_url: Optional[str] = None
    fields: List[FieldDefinition] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_used_at: Optional[datetime] = None

class TemplateCreate(BaseModel):
    name: str
    fields: List[FieldDefinition] = []

class WorkflowRun(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    configuration_id: str
    template_id: Optional[str] = None
    run_mode: str = "full_flow"  # extraction_only, matching_only, full_flow
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    email_filters: Dict[str, Any] = {}
    status: str = "pending"  # pending, running, completed, failed
    documents_processed: int = 0
    successful_extractions: int = 0
    matched_records: int = 0
    flagged_records: int = 0
    errors: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    logs: List[str] = []

class WorkflowRunCreate(BaseModel):
    configuration_id: str
    template_id: Optional[str] = None
    run_mode: str = "full_flow"
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    email_filters: Dict[str, Any] = {}

class ExtractedDocument(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_run_id: str
    email_subject: Optional[str] = None
    email_sender: Optional[str] = None
    email_date: Optional[datetime] = None
    attachment_name: str
    document_url: Optional[str] = None
    storage_path: Optional[str] = None
    extracted_fields: Dict[str, Any] = {}
    confidence_scores: Dict[str, float] = {}
    matching_status: str = "pending"  # pending, matched, partial_match, no_match
    matching_results: Dict[str, Any] = {}
    document_status: str = "pending"  # pending, approved, rejected, flagged
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = None

class DashboardStats(BaseModel):
    total_runs: int = 0
    documents_processed: int = 0
    successful_extractions: int = 0
    matched_records: int = 0
    flagged_records: int = 0
    errors: int = 0
    documents_per_day: List[Dict[str, Any]] = []
    extraction_success_rate: float = 0.0
    matching_success_rate: float = 0.0

# ============= STORAGE FUNCTIONS =============

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        logger.info("Storage initialized successfully")
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise Exception("Storage not initialized")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    key = init_storage()
    if not key:
        raise Exception("Storage not initialized")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ============= AI EXTRACTION =============

async def extract_fields_with_ai(file_path: str, file_type: str, fields: List[FieldDefinition]) -> Dict[str, Any]:
    """Extract fields from document using Gemini (supports file attachments)"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
    
    try:
        field_descriptions = "\n".join([
            f"- {f.name} ({f.field_type}): {f.description or 'No description'}"
            for f in fields
        ])
        
        system_message = """You are a document extraction AI. Extract the requested fields from the document.
Return your response as a valid JSON object with the field names as keys.
For each field, also provide a confidence score between 0 and 1.
Format: {"fields": {"field_name": "value", ...}, "confidence": {"field_name": 0.95, ...}}
If a field cannot be found, use null as the value and 0.0 as confidence."""

        mime_types = {
            "pdf": "application/pdf",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "txt": "text/plain",
            "csv": "text/csv",
            "json": "application/json"
        }
        
        mime_type = mime_types.get(file_type.lower(), "application/pdf")
        
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=str(uuid.uuid4()),
            system_message=system_message
        ).with_model("gemini", "gemini-2.5-flash")
        
        file_content = FileContentWithMimeType(
            file_path=file_path,
            mime_type=mime_type
        )
        
        user_message = UserMessage(
            text=f"""Please extract the following fields from this document:

{field_descriptions}

Return the extracted data as JSON.""",
            file_contents=[file_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Parse the JSON response
        try:
            # Try to extract JSON from the response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
                return result
        except json.JSONDecodeError:
            pass
        
        # Fallback: return raw response
        return {
            "fields": {"raw_response": response},
            "confidence": {"raw_response": 0.5}
        }
        
    except Exception as e:
        logger.error(f"AI extraction failed: {e}")
        return {
            "fields": {},
            "confidence": {},
            "error": str(e)
        }

async def detect_fields_from_document(file_path: str, file_type: str) -> List[FieldDefinition]:
    """Detect possible fields from a sample document"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
    
    try:
        system_message = """You are a document analysis AI. Analyze the document and identify all extractable fields.
Return a JSON array of field definitions.
Format: [{"name": "field_name", "field_type": "text|number|date|currency", "description": "brief description"}]
Common field types:
- text: general text fields
- number: numeric values
- date: dates in any format
- currency: monetary amounts"""

        mime_types = {
            "pdf": "application/pdf",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "txt": "text/plain",
            "csv": "text/csv",
            "json": "application/json"
        }
        
        mime_type = mime_types.get(file_type.lower(), "application/pdf")
        
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=str(uuid.uuid4()),
            system_message=system_message
        ).with_model("gemini", "gemini-2.5-flash")
        
        file_content = FileContentWithMimeType(
            file_path=file_path,
            mime_type=mime_type
        )
        
        user_message = UserMessage(
            text="Analyze this document and identify all extractable fields. Return as JSON array.",
            file_contents=[file_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Parse the JSON response
        try:
            json_start = response.find('[')
            json_end = response.rfind(']') + 1
            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                fields_data = json.loads(json_str)
                return [FieldDefinition(**f) for f in fields_data]
        except json.JSONDecodeError:
            pass
        
        return []
        
    except Exception as e:
        logger.error(f"Field detection failed: {e}")
        return []

# ============= MATCHING ENGINE =============

def run_matching(extracted_data: Dict[str, Any], matching_config: MatchingLogicConfig, source_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Run matching logic against source data"""
    if not source_data or not matching_config.rules:
        return {"status": "no_match", "matched_record": None, "score": 0, "field_matches": {}}
    
    best_match = None
    best_score = 0
    best_field_matches = {}
    
    for source_record in source_data:
        total_score = 0
        max_possible_score = 0
        field_matches = {}
        
        for rule in matching_config.rules:
            field_name = rule.field_name
            if field_name not in extracted_data:
                continue
                
            extracted_value = extracted_data.get(field_name)
            source_value = source_record.get(field_name)
            
            # Weight based on priority (lower priority = higher weight)
            weight = 1.0 / rule.priority if rule.priority > 0 else 1.0
            max_possible_score += weight
            
            if extracted_value is None or source_value is None:
                field_matches[field_name] = {"extracted": extracted_value, "source": source_value, "score": 0, "match_type": rule.match_type}
                continue
            
            score = 0
            if rule.match_type == "exact":
                score = 1.0 if str(extracted_value).strip() == str(source_value).strip() else 0.0
            elif rule.match_type == "case_insensitive":
                score = 1.0 if str(extracted_value).lower().strip() == str(source_value).lower().strip() else 0.0
            elif rule.match_type == "contains":
                score = 1.0 if str(source_value).lower() in str(extracted_value).lower() else 0.0
            elif rule.match_type == "fuzzy":
                from difflib import SequenceMatcher
                ratio = SequenceMatcher(None, str(extracted_value).lower().strip(), str(source_value).lower().strip()).ratio()
                score = ratio  # Use the actual ratio, not just binary
            elif rule.match_type == "numeric_tolerance":
                try:
                    # Handle currency formatting
                    extracted_num = float(str(extracted_value).replace(',', '').replace('$', '').replace('₹', ''))
                    source_num = float(str(source_value).replace(',', '').replace('$', '').replace('₹', ''))
                    diff = abs(extracted_num - source_num)
                    tolerance = rule.tolerance_value or 0
                    if diff <= tolerance:
                        score = 1.0
                    else:
                        # Partial score based on how close it is
                        score = max(0, 1.0 - (diff - tolerance) / (source_num + 0.01))
                except (ValueError, TypeError):
                    score = 0.0
            elif rule.match_type == "date_tolerance":
                try:
                    from dateutil.parser import parse
                    extracted_date = parse(str(extracted_value))
                    source_date = parse(str(source_value))
                    diff_days = abs((extracted_date - source_date).days)
                    tolerance = rule.tolerance_value or 0
                    score = 1.0 if diff_days <= tolerance else 0.0
                except:
                    score = 0.0
            
            field_matches[field_name] = {
                "extracted": extracted_value,
                "source": source_value,
                "score": score,
                "match_type": rule.match_type
            }
            total_score += score * weight
        
        if max_possible_score > 0:
            normalized_score = total_score / max_possible_score
            if normalized_score > best_score:
                best_score = normalized_score
                best_match = source_record
                best_field_matches = field_matches
    
    if best_score >= 0.9:
        status = "matched"
    elif best_score >= 0.5:
        status = "partial_match"
    else:
        status = "no_match"
    
    return {
        "status": status,
        "matched_record": best_match,
        "score": best_score,
        "field_matches": best_field_matches
    }

# ============= SSE FOR LOGS =============

workflow_logs = {}

async def add_workflow_log(run_id: str, message: str):
    """Add a log message to a workflow run"""
    if run_id not in workflow_logs:
        workflow_logs[run_id] = []
    
    timestamp = datetime.now(timezone.utc).isoformat()
    log_entry = f"[{timestamp}] {message}"
    workflow_logs[run_id].append(log_entry)
    
    # Also update in database
    await db.workflow_runs.update_one(
        {"id": run_id},
        {"$push": {"logs": log_entry}}
    )

# ============= API ROUTES =============

@api_router.get("/")
async def root():
    return {"message": "Document Extraction Platform API", "version": "1.0.0"}

# Dashboard Stats
@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    # Get totals
    total_runs = await db.workflow_runs.count_documents({})
    
    # Aggregate document stats
    pipeline = [
        {"$group": {
            "_id": None,
            "documents_processed": {"$sum": "$documents_processed"},
            "successful_extractions": {"$sum": "$successful_extractions"},
            "matched_records": {"$sum": "$matched_records"},
            "flagged_records": {"$sum": "$flagged_records"},
            "errors": {"$sum": "$errors"}
        }}
    ]
    
    stats_result = await db.workflow_runs.aggregate(pipeline).to_list(1)
    
    if stats_result:
        stats = stats_result[0]
    else:
        stats = {
            "documents_processed": 0,
            "successful_extractions": 0,
            "matched_records": 0,
            "flagged_records": 0,
            "errors": 0
        }
    
    # Calculate rates
    docs = stats.get("documents_processed", 0)
    extraction_rate = (stats.get("successful_extractions", 0) / docs * 100) if docs > 0 else 0
    matching_rate = (stats.get("matched_records", 0) / docs * 100) if docs > 0 else 0
    
    # Get documents per day (last 7 days)
    from datetime import timedelta
    today = datetime.now(timezone.utc)
    seven_days_ago = today - timedelta(days=7)
    
    daily_pipeline = [
        {"$match": {"created_at": {"$gte": seven_days_ago.isoformat()}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "count": {"$sum": "$documents_processed"}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    daily_results = await db.workflow_runs.aggregate(daily_pipeline).to_list(7)
    docs_per_day = [{"date": r["_id"], "count": r["count"]} for r in daily_results]
    
    return DashboardStats(
        total_runs=total_runs,
        documents_processed=stats.get("documents_processed", 0),
        successful_extractions=stats.get("successful_extractions", 0),
        matched_records=stats.get("matched_records", 0),
        flagged_records=stats.get("flagged_records", 0),
        errors=stats.get("errors", 0),
        documents_per_day=docs_per_day,
        extraction_success_rate=extraction_rate,
        matching_success_rate=matching_rate
    )

# Recent runs
@api_router.get("/dashboard/recent-runs")
async def get_recent_runs(limit: int = 10):
    runs = await db.workflow_runs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return runs

# ============= CONFIGURATION PROFILES =============

@api_router.post("/configurations", response_model=ConfigurationProfile)
async def create_configuration(config: ConfigurationProfileCreate):
    config_obj = ConfigurationProfile(
        name=config.name,
        description=config.description,
        ai_provider=config.ai_provider or AIProviderConfig(),
        email_provider=config.email_provider or EmailProviderConfig(),
        storage_config=config.storage_config or StorageConfig(),
        database_config=config.database_config or DatabaseConfig(),
        matching_source=config.matching_source or MatchingSourceConfig(),
        matching_logic=config.matching_logic or MatchingLogicConfig()
    )
    
    doc = config_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.configurations.insert_one(doc)
    return config_obj

@api_router.get("/configurations", response_model=List[ConfigurationProfile])
async def list_configurations():
    configs = await db.configurations.find({}, {"_id": 0}).to_list(100)
    for c in configs:
        if isinstance(c.get('created_at'), str):
            c['created_at'] = datetime.fromisoformat(c['created_at'].replace('Z', '+00:00'))
        if isinstance(c.get('updated_at'), str):
            c['updated_at'] = datetime.fromisoformat(c['updated_at'].replace('Z', '+00:00'))
    return configs

@api_router.get("/configurations/{config_id}", response_model=ConfigurationProfile)
async def get_configuration(config_id: str):
    config = await db.configurations.find_one({"id": config_id}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    if isinstance(config.get('created_at'), str):
        config['created_at'] = datetime.fromisoformat(config['created_at'].replace('Z', '+00:00'))
    if isinstance(config.get('updated_at'), str):
        config['updated_at'] = datetime.fromisoformat(config['updated_at'].replace('Z', '+00:00'))
    return config

@api_router.put("/configurations/{config_id}", response_model=ConfigurationProfile)
async def update_configuration(config_id: str, config: ConfigurationProfileCreate):
    existing = await db.configurations.find_one({"id": config_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    update_data = config.model_dump(exclude_unset=True)
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.configurations.update_one({"id": config_id}, {"$set": update_data})
    
    updated = await db.configurations.find_one({"id": config_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'].replace('Z', '+00:00'))
    if isinstance(updated.get('updated_at'), str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'].replace('Z', '+00:00'))
    return updated

@api_router.delete("/configurations/{config_id}")
async def delete_configuration(config_id: str):
    result = await db.configurations.delete_one({"id": config_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return {"message": "Configuration deleted"}

# ============= TEMPLATES =============

@api_router.post("/templates", response_model=Template)
async def create_template(template: TemplateCreate):
    template_obj = Template(
        name=template.name,
        fields=template.fields
    )
    
    doc = template_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('last_used_at'):
        doc['last_used_at'] = doc['last_used_at'].isoformat()
    
    await db.templates.insert_one(doc)
    return template_obj

@api_router.get("/templates", response_model=List[Template])
async def list_templates():
    templates = await db.templates.find({}, {"_id": 0}).to_list(100)
    for t in templates:
        if isinstance(t.get('created_at'), str):
            t['created_at'] = datetime.fromisoformat(t['created_at'].replace('Z', '+00:00'))
        if t.get('last_used_at') and isinstance(t['last_used_at'], str):
            t['last_used_at'] = datetime.fromisoformat(t['last_used_at'].replace('Z', '+00:00'))
    return templates

@api_router.get("/templates/{template_id}", response_model=Template)
async def get_template(template_id: str):
    template = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if isinstance(template.get('created_at'), str):
        template['created_at'] = datetime.fromisoformat(template['created_at'].replace('Z', '+00:00'))
    if template.get('last_used_at') and isinstance(template['last_used_at'], str):
        template['last_used_at'] = datetime.fromisoformat(template['last_used_at'].replace('Z', '+00:00'))
    return template

@api_router.put("/templates/{template_id}", response_model=Template)
async def update_template(template_id: str, template: TemplateCreate):
    existing = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = template.model_dump(exclude_unset=True)
    await db.templates.update_one({"id": template_id}, {"$set": update_data})
    
    updated = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'].replace('Z', '+00:00'))
    if updated.get('last_used_at') and isinstance(updated['last_used_at'], str):
        updated['last_used_at'] = datetime.fromisoformat(updated['last_used_at'].replace('Z', '+00:00'))
    return updated

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    result = await db.templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

# Upload sample document and detect fields
@api_router.post("/templates/analyze")
async def analyze_sample_document(file: UploadFile = File(...)):
    # Save file temporarily
    file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'pdf'
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Detect fields using AI
        fields = await detect_fields_from_document(tmp_path, file_ext)
        
        # Store file in storage
        storage_path = f"{APP_NAME}/samples/{uuid.uuid4()}.{file_ext}"
        put_object(storage_path, content, file.content_type or "application/octet-stream")
        
        return {
            "detected_fields": [f.model_dump() for f in fields],
            "sample_document_path": storage_path,
            "filename": file.filename
        }
    finally:
        os.unlink(tmp_path)

# ============= WORKFLOW RUNS =============

@api_router.post("/workflows", response_model=WorkflowRun)
async def create_workflow_run(workflow: WorkflowRunCreate):
    run_obj = WorkflowRun(
        configuration_id=workflow.configuration_id,
        template_id=workflow.template_id,
        run_mode=workflow.run_mode,
        date_from=workflow.date_from,
        date_to=workflow.date_to,
        email_filters=workflow.email_filters
    )
    
    doc = run_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('date_from'):
        doc['date_from'] = doc['date_from'].isoformat()
    if doc.get('date_to'):
        doc['date_to'] = doc['date_to'].isoformat()
    
    await db.workflow_runs.insert_one(doc)
    return run_obj

@api_router.get("/workflows", response_model=List[WorkflowRun])
async def list_workflow_runs(limit: int = 50):
    runs = await db.workflow_runs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    for r in runs:
        if isinstance(r.get('created_at'), str):
            r['created_at'] = datetime.fromisoformat(r['created_at'].replace('Z', '+00:00'))
        if r.get('date_from') and isinstance(r['date_from'], str):
            r['date_from'] = datetime.fromisoformat(r['date_from'].replace('Z', '+00:00'))
        if r.get('date_to') and isinstance(r['date_to'], str):
            r['date_to'] = datetime.fromisoformat(r['date_to'].replace('Z', '+00:00'))
        if r.get('completed_at') and isinstance(r['completed_at'], str):
            r['completed_at'] = datetime.fromisoformat(r['completed_at'].replace('Z', '+00:00'))
    return runs

@api_router.get("/workflows/{run_id}", response_model=WorkflowRun)
async def get_workflow_run(run_id: str):
    run = await db.workflow_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Workflow run not found")
    if isinstance(run.get('created_at'), str):
        run['created_at'] = datetime.fromisoformat(run['created_at'].replace('Z', '+00:00'))
    if run.get('date_from') and isinstance(run['date_from'], str):
        run['date_from'] = datetime.fromisoformat(run['date_from'].replace('Z', '+00:00'))
    if run.get('date_to') and isinstance(run['date_to'], str):
        run['date_to'] = datetime.fromisoformat(run['date_to'].replace('Z', '+00:00'))
    if run.get('completed_at') and isinstance(run['completed_at'], str):
        run['completed_at'] = datetime.fromisoformat(run['completed_at'].replace('Z', '+00:00'))
    return run

# Delete workflow run
@api_router.delete("/workflows/{run_id}")
async def delete_workflow_run(run_id: str):
    result = await db.workflow_runs.delete_one({"id": run_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workflow run not found")
    # Also delete associated documents
    await db.documents.delete_many({"workflow_run_id": run_id})
    return {"message": "Workflow run deleted"}

# Start workflow execution (simulated for MVP without Gmail OAuth)
@api_router.post("/workflows/{run_id}/start")
async def start_workflow(run_id: str):
    run = await db.workflow_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Workflow run not found")
    
    # Update status to running
    await db.workflow_runs.update_one({"id": run_id}, {"$set": {"status": "running"}})
    
    # Add initial log
    await add_workflow_log(run_id, "Workflow started")
    
    return {"message": "Workflow started", "run_id": run_id}

# SSE endpoint for workflow logs
@api_router.get("/workflows/{run_id}/logs/stream")
async def stream_workflow_logs(run_id: str):
    from sse_starlette.sse import EventSourceResponse
    
    async def event_generator():
        last_index = 0
        while True:
            run = await db.workflow_runs.find_one({"id": run_id}, {"_id": 0})
            if not run:
                yield {"data": json.dumps({"error": "Run not found"})}
                break
            
            logs = run.get("logs", [])
            if len(logs) > last_index:
                for log in logs[last_index:]:
                    yield {"data": json.dumps({"log": log})}
                last_index = len(logs)
            
            if run.get("status") in ["completed", "failed"]:
                yield {"data": json.dumps({"status": run["status"], "complete": True})}
                break
            
            await asyncio.sleep(1)
    
    return EventSourceResponse(event_generator())

# ============= DOCUMENTS =============

@api_router.get("/documents", response_model=List[ExtractedDocument])
async def list_documents(
    workflow_run_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100
):
    query = {}
    if workflow_run_id:
        query["workflow_run_id"] = workflow_run_id
    if status:
        query["document_status"] = status
    
    docs = await db.documents.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    for d in docs:
        if isinstance(d.get('created_at'), str):
            d['created_at'] = datetime.fromisoformat(d['created_at'].replace('Z', '+00:00'))
        if d.get('email_date') and isinstance(d['email_date'], str):
            d['email_date'] = datetime.fromisoformat(d['email_date'].replace('Z', '+00:00'))
        if d.get('reviewed_at') and isinstance(d['reviewed_at'], str):
            d['reviewed_at'] = datetime.fromisoformat(d['reviewed_at'].replace('Z', '+00:00'))
    return docs

@api_router.get("/documents/{doc_id}", response_model=ExtractedDocument)
async def get_document(doc_id: str):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if isinstance(doc.get('created_at'), str):
        doc['created_at'] = datetime.fromisoformat(doc['created_at'].replace('Z', '+00:00'))
    if doc.get('email_date') and isinstance(doc['email_date'], str):
        doc['email_date'] = datetime.fromisoformat(doc['email_date'].replace('Z', '+00:00'))
    return doc

@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    result = await db.documents.delete_one({"id": doc_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}

@api_router.put("/documents/{doc_id}/review")
async def review_document(doc_id: str, action: str = Query(...), updated_fields: Optional[Dict[str, Any]] = None):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    update_data = {
        "document_status": action,  # approved, rejected, flagged
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    
    if updated_fields:
        update_data["extracted_fields"] = updated_fields
    
    await db.documents.update_one({"id": doc_id}, {"$set": update_data})
    
    return {"message": f"Document {action}", "doc_id": doc_id}

# Upload document for processing
@api_router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    template_id: Optional[str] = None,
    workflow_run_id: Optional[str] = None
):
    file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'pdf'
    content = await file.read()
    
    # Store file
    storage_path = f"{APP_NAME}/documents/{uuid.uuid4()}.{file_ext}"
    put_object(storage_path, content, file.content_type or "application/octet-stream")
    
    # Get template fields if template specified
    fields = []
    if template_id:
        template = await db.templates.find_one({"id": template_id}, {"_id": 0})
        if template:
            fields = [FieldDefinition(**f) for f in template.get("fields", [])]
    
    # If no template, use default invoice fields for extraction
    if not fields:
        fields = [
            FieldDefinition(name="invoice_number", field_type="text", description="Invoice or bill number"),
            FieldDefinition(name="date", field_type="date", description="Invoice or document date"),
            FieldDefinition(name="total_amount", field_type="currency", description="Total amount"),
            FieldDefinition(name="vendor_name", field_type="text", description="Vendor or company name"),
            FieldDefinition(name="customer_name", field_type="text", description="Customer or recipient name"),
            FieldDefinition(name="description", field_type="text", description="Description or line items summary"),
        ]
    
    # Extract fields
    extracted_data = {}
    confidence_scores = {}
    
    # Save to temp file for AI processing
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        result = await extract_fields_with_ai(tmp_path, file_ext, fields)
        extracted_data = result.get("fields", {})
        confidence_scores = result.get("confidence", {})
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
    finally:
        os.unlink(tmp_path)
    
    # Create document record
    doc_obj = ExtractedDocument(
        workflow_run_id=workflow_run_id or "manual",
        attachment_name=file.filename,
        storage_path=storage_path,
        extracted_fields=extracted_data,
        confidence_scores=confidence_scores
    )
    
    doc_dict = doc_obj.model_dump()
    doc_dict['created_at'] = doc_dict['created_at'].isoformat()
    
    await db.documents.insert_one(doc_dict)
    
    return {
        "id": doc_obj.id,
        "storage_path": storage_path,
        "extracted_fields": extracted_data,
        "confidence_scores": confidence_scores
    }

# Re-extract document with specific template
@api_router.post("/documents/{doc_id}/reextract")
async def reextract_document(doc_id: str, template_id: Optional[str] = None):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    storage_path = doc.get("storage_path")
    if not storage_path:
        raise HTTPException(status_code=404, detail="Document file not found in storage")
    
    # Get file content from storage
    try:
        content, content_type = get_object(storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not retrieve file: {e}")
    
    # Get template fields
    fields = []
    if template_id:
        template = await db.templates.find_one({"id": template_id}, {"_id": 0})
        if template:
            fields = [FieldDefinition(**f) for f in template.get("fields", [])]
    
    # If no template, use default fields
    if not fields:
        fields = [
            FieldDefinition(name="invoice_number", field_type="text", description="Invoice or bill number"),
            FieldDefinition(name="date", field_type="date", description="Invoice or document date"),
            FieldDefinition(name="total_amount", field_type="currency", description="Total amount"),
            FieldDefinition(name="vendor_name", field_type="text", description="Vendor or company name"),
            FieldDefinition(name="customer_name", field_type="text", description="Customer or recipient name"),
            FieldDefinition(name="description", field_type="text", description="Description or line items summary"),
        ]
    
    # Get file extension
    file_ext = storage_path.split('.')[-1].lower() if '.' in storage_path else 'pdf'
    
    # Save to temp file for AI processing
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        result = await extract_fields_with_ai(tmp_path, file_ext, fields)
        extracted_data = result.get("fields", {})
        confidence_scores = result.get("confidence", {})
    except Exception as e:
        logger.error(f"Re-extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")
    finally:
        os.unlink(tmp_path)
    
    # Update document
    await db.documents.update_one(
        {"id": doc_id},
        {"$set": {
            "extracted_fields": extracted_data,
            "confidence_scores": confidence_scores
        }}
    )
    
    return {
        "id": doc_id,
        "extracted_fields": extracted_data,
        "confidence_scores": confidence_scores
    }

# Download document
@api_router.get("/documents/{doc_id}/download")
async def download_document(doc_id: str):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    storage_path = doc.get("storage_path")
    if not storage_path:
        raise HTTPException(status_code=404, detail="Document file not found")
    
    try:
        content, content_type = get_object(storage_path)
        filename = doc.get("attachment_name", "document")
        return Response(
            content=content,
            media_type=content_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============= EXPORT =============

@api_router.get("/export/documents")
async def export_documents(
    workflow_run_id: Optional[str] = None,
    format: str = "csv"
):
    import csv
    import io
    
    query = {}
    if workflow_run_id:
        query["workflow_run_id"] = workflow_run_id
    
    docs = await db.documents.find(query, {"_id": 0}).to_list(1000)
    
    if format == "csv":
        output = io.StringIO()
        if docs:
            # Get all field names
            field_names = set()
            for d in docs:
                field_names.update(d.get("extracted_fields", {}).keys())
            
            headers = ["id", "attachment_name", "email_subject", "email_sender", "document_status", "matching_status"] + list(field_names)
            writer = csv.DictWriter(output, fieldnames=headers)
            writer.writeheader()
            
            for d in docs:
                row = {
                    "id": d.get("id"),
                    "attachment_name": d.get("attachment_name"),
                    "email_subject": d.get("email_subject"),
                    "email_sender": d.get("email_sender"),
                    "document_status": d.get("document_status"),
                    "matching_status": d.get("matching_status")
                }
                row.update(d.get("extracted_fields", {}))
                writer.writerow(row)
        
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=documents_export.csv"}
        )
    
    return docs

# ============= EMAIL CONNECTION =============

import imaplib
import email
from email.header import decode_header

class EmailConnection:
    """IMAP email connection handler"""
    
    def __init__(self, config: EmailProviderConfig):
        self.config = config
        self.connection = None
    
    def connect(self) -> tuple:
        """Connect to IMAP server. Returns (success, message)"""
        try:
            # Determine host based on provider
            if self.config.provider_type == "gmail":
                host = "imap.gmail.com"
                port = 993
            elif self.config.provider_type == "outlook":
                host = "outlook.office365.com"
                port = 993
            else:
                host = self.config.host
                port = self.config.port or 993
            
            if not self.config.username or not self.config.password:
                return False, "Email username and password are required"
            
            # Connect to IMAP server
            if self.config.use_ssl:
                self.connection = imaplib.IMAP4_SSL(host, port)
            else:
                self.connection = imaplib.IMAP4(host, port)
            
            # Login
            self.connection.login(self.config.username, self.config.password)
            
            return True, f"Connected to {self.config.username}"
            
        except imaplib.IMAP4.error as e:
            error_msg = str(e)
            if "AUTHENTICATIONFAILED" in error_msg or "Invalid credentials" in error_msg.lower():
                return False, "Authentication failed. Please check your email and app password."
            return False, f"IMAP error: {error_msg}"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"
    
    def disconnect(self):
        """Disconnect from IMAP server"""
        if self.connection:
            try:
                self.connection.logout()
            except:
                pass
            self.connection = None
    
    def fetch_emails(self, date_from=None, date_to=None, sender_filter=None, subject_filter=None, limit=50):
        """Fetch emails with attachments"""
        if not self.connection:
            return []
        
        try:
            # Select inbox
            self.connection.select("INBOX")
            
            # Build search criteria
            criteria = []
            if date_from:
                criteria.append(f'SINCE {date_from.strftime("%d-%b-%Y")}')
            if date_to:
                criteria.append(f'BEFORE {date_to.strftime("%d-%b-%Y")}')
            if sender_filter:
                criteria.append(f'FROM "{sender_filter}"')
            if subject_filter:
                criteria.append(f'SUBJECT "{subject_filter}"')
            
            search_query = " ".join(criteria) if criteria else "ALL"
            
            # Search emails
            status, messages = self.connection.search(None, search_query)
            if status != "OK":
                return []
            
            email_ids = messages[0].split()
            emails_with_attachments = []
            
            # Process emails (most recent first, limited)
            for email_id in reversed(email_ids[-limit:]):
                status, msg_data = self.connection.fetch(email_id, "(RFC822)")
                if status != "OK":
                    continue
                
                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)
                
                # Get email metadata
                subject = self._decode_header(msg["Subject"])
                sender = self._decode_header(msg["From"])
                date_str = msg["Date"]
                
                # Parse date
                try:
                    from email.utils import parsedate_to_datetime
                    email_date = parsedate_to_datetime(date_str)
                except:
                    email_date = datetime.now(timezone.utc)
                
                # Find attachments
                attachments = []
                for part in msg.walk():
                    content_disposition = str(part.get("Content-Disposition"))
                    if "attachment" in content_disposition:
                        filename = part.get_filename()
                        if filename:
                            filename = self._decode_header(filename)
                            # Only include supported file types
                            ext = filename.split(".")[-1].lower() if "." in filename else ""
                            if ext in ["pdf", "png", "jpg", "jpeg", "docx", "xlsx", "csv"]:
                                attachments.append({
                                    "filename": filename,
                                    "content": part.get_payload(decode=True),
                                    "content_type": part.get_content_type()
                                })
                
                if attachments:
                    emails_with_attachments.append({
                        "subject": subject,
                        "sender": sender,
                        "date": email_date,
                        "attachments": attachments
                    })
            
            return emails_with_attachments
            
        except Exception as e:
            logger.error(f"Error fetching emails: {e}")
            return []
    
    def _decode_header(self, header_value):
        """Decode email header value"""
        if not header_value:
            return ""
        decoded_parts = decode_header(header_value)
        decoded_string = ""
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                decoded_string += part.decode(encoding or "utf-8", errors="replace")
            else:
                decoded_string += part
        return decoded_string

# Test email connection endpoint
@api_router.post("/configurations/{config_id}/test-email")
async def test_email_connection(config_id: str):
    """Test email connection for a configuration"""
    config = await db.configurations.find_one({"id": config_id}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    email_config = EmailProviderConfig(**config.get("email_provider", {}))
    
    if not email_config.username or not email_config.password:
        return {
            "success": False,
            "message": "Email username and password are required. Please configure them first."
        }
    
    email_conn = EmailConnection(email_config)
    success, message = email_conn.connect()
    
    if success:
        email_conn.disconnect()
    
    return {
        "success": success,
        "message": message
    }

# Fetch emails endpoint
@api_router.post("/configurations/{config_id}/fetch-emails")
async def fetch_emails_from_config(
    config_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sender_filter: Optional[str] = None,
    subject_filter: Optional[str] = None,
    limit: int = 10
):
    """Fetch emails from configured email provider"""
    config = await db.configurations.find_one({"id": config_id}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    email_config = EmailProviderConfig(**config.get("email_provider", {}))
    
    email_conn = EmailConnection(email_config)
    success, message = email_conn.connect()
    
    if not success:
        return {
            "success": False,
            "message": message,
            "emails": []
        }
    
    try:
        # Parse dates
        parsed_from = datetime.fromisoformat(date_from) if date_from else None
        parsed_to = datetime.fromisoformat(date_to) if date_to else None
        
        emails = email_conn.fetch_emails(
            date_from=parsed_from,
            date_to=parsed_to,
            sender_filter=sender_filter,
            subject_filter=subject_filter,
            limit=limit
        )
        
        # Return email summaries (without actual content for preview)
        email_summaries = []
        for em in emails:
            email_summaries.append({
                "subject": em["subject"],
                "sender": em["sender"],
                "date": em["date"].isoformat(),
                "attachment_count": len(em["attachments"]),
                "attachments": [a["filename"] for a in em["attachments"]]
            })
        
        return {
            "success": True,
            "message": f"Found {len(emails)} emails with attachments",
            "emails": email_summaries
        }
        
    finally:
        email_conn.disconnect()

# ============= MATCHING ENDPOINTS =============

class MatchingSourceData(BaseModel):
    """Model for matching source data upload"""
    data: List[Dict[str, Any]]

@api_router.post("/configurations/{config_id}/matching-source")
async def upload_matching_source(config_id: str, source_data: MatchingSourceData):
    """Upload matching source data (from CSV/Excel/API)"""
    config = await db.configurations.find_one({"id": config_id}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    # Store the matching source data
    await db.matching_sources.update_one(
        {"configuration_id": config_id},
        {"$set": {
            "configuration_id": config_id,
            "data": source_data.data,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {
        "message": f"Uploaded {len(source_data.data)} records for matching",
        "record_count": len(source_data.data)
    }

@api_router.get("/configurations/{config_id}/matching-source")
async def get_matching_source(config_id: str):
    """Get matching source data for a configuration"""
    source = await db.matching_sources.find_one({"configuration_id": config_id}, {"_id": 0})
    if not source:
        return {"data": [], "record_count": 0}
    
    return {
        "data": source.get("data", []),
        "record_count": len(source.get("data", [])),
        "updated_at": source.get("updated_at")
    }

@api_router.post("/documents/{doc_id}/match")
async def match_document(doc_id: str, config_id: str):
    """Run matching on a single document"""
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    config = await db.configurations.find_one({"id": config_id}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    # Get matching source data
    source = await db.matching_sources.find_one({"configuration_id": config_id}, {"_id": 0})
    source_data = source.get("data", []) if source else []
    
    if not source_data:
        return {
            "status": "no_source",
            "message": "No matching source data configured. Please upload source data first."
        }
    
    # Get matching logic config
    matching_logic = MatchingLogicConfig(**config.get("matching_logic", {}))
    
    if not matching_logic.rules:
        return {
            "status": "no_rules",
            "message": "No matching rules configured. Please configure matching rules first."
        }
    
    # Run matching
    extracted_fields = doc.get("extracted_fields", {})
    result = run_matching(extracted_fields, matching_logic, source_data)
    
    # Update document with matching results
    await db.documents.update_one(
        {"id": doc_id},
        {"$set": {
            "matching_status": result["status"],
            "matching_results": result
        }}
    )
    
    return result

@api_router.post("/workflows/{run_id}/match-all")
async def match_all_documents(run_id: str, config_id: str):
    """Run matching on all documents in a workflow run"""
    config = await db.configurations.find_one({"id": config_id}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    # Get matching source data
    source = await db.matching_sources.find_one({"configuration_id": config_id}, {"_id": 0})
    source_data = source.get("data", []) if source else []
    
    if not source_data:
        return {
            "status": "no_source",
            "message": "No matching source data configured",
            "matched": 0, "partial": 0, "no_match": 0
        }
    
    # Get matching logic config
    matching_logic = MatchingLogicConfig(**config.get("matching_logic", {}))
    
    if not matching_logic.rules:
        return {
            "status": "no_rules",
            "message": "No matching rules configured",
            "matched": 0, "partial": 0, "no_match": 0
        }
    
    # Get all documents for this workflow
    docs = await db.documents.find({"workflow_run_id": run_id}, {"_id": 0}).to_list(1000)
    
    results = {"matched": 0, "partial_match": 0, "no_match": 0}
    
    for doc in docs:
        extracted_fields = doc.get("extracted_fields", {})
        if not extracted_fields:
            continue
            
        result = run_matching(extracted_fields, matching_logic, source_data)
        
        await db.documents.update_one(
            {"id": doc["id"]},
            {"$set": {
                "matching_status": result["status"],
                "matching_results": result
            }}
        )
        
        results[result["status"]] = results.get(result["status"], 0) + 1
    
    return {
        "status": "completed",
        "message": f"Processed {len(docs)} documents",
        **results
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    try:
        init_storage()
    except Exception as e:
        logger.warning(f"Storage initialization delayed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

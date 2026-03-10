import requests
import sys
import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

class DocumentExtractionAPITester:
    def __init__(self, base_url="https://ai-doc-match-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = []  # Track created resources for cleanup

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        
        if not files:
            headers['Content-Type'] = 'application/json'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, timeout=60)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=60)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    if response.content:
                        return True, response.json()
                    return True, {}
                except:
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text[:200]}...")
                return False, {}

        except requests.exceptions.RequestException as e:
            print(f"❌ Failed - Network Error: {str(e)}")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET", 
            "",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats", 
            200
        )
        if success:
            expected_fields = [
                'total_runs', 'documents_processed', 'successful_extractions',
                'matched_records', 'flagged_records', 'errors', 
                'documents_per_day', 'extraction_success_rate', 'matching_success_rate'
            ]
            for field in expected_fields:
                if field not in response:
                    print(f"⚠️  Missing expected field: {field}")
                    return False
            print(f"📊 Stats: {response['total_runs']} runs, {response['documents_processed']} documents")
        return success

    def test_recent_runs(self):
        """Test recent runs endpoint"""
        success, response = self.run_test(
            "Recent Runs",
            "GET",
            "dashboard/recent-runs?limit=5",
            200
        )
        if success:
            print(f"📋 Found {len(response)} recent runs")
        return success

    def test_configurations_crud(self):
        """Test configuration CRUD operations"""
        
        # Test list configurations
        success, configs = self.run_test(
            "List Configurations",
            "GET",
            "configurations",
            200
        )
        if not success:
            return False

        print(f"📝 Found {len(configs)} configurations")

        # Test create configuration
        config_data = {
            "name": f"Test Config {datetime.now().strftime('%H%M%S')}",
            "description": "Automated test configuration",
            "ai_provider": {
                "provider_name": "openai",
                "model_name": "gpt-5o-mini"
            },
            "email_provider": {
                "provider_type": "gmail"
            }
        }

        success, new_config = self.run_test(
            "Create Configuration",
            "POST",
            "configurations",
            200,
            config_data
        )
        if not success:
            return False

        config_id = new_config.get('id')
        if config_id:
            self.created_resources.append(('configuration', config_id))
            print(f"✅ Created configuration with ID: {config_id}")

            # Test get single configuration
            success, config = self.run_test(
                "Get Configuration",
                "GET",
                f"configurations/{config_id}",
                200
            )
            if not success:
                return False

            # Test update configuration
            update_data = {
                "name": "Updated Test Config",
                "description": "Updated description"
            }
            success, updated_config = self.run_test(
                "Update Configuration", 
                "PUT",
                f"configurations/{config_id}",
                200,
                update_data
            )
            if not success:
                return False

        return True

    def test_templates_crud(self):
        """Test template CRUD operations"""
        
        # Test list templates
        success, templates = self.run_test(
            "List Templates",
            "GET",
            "templates",
            200
        )
        if not success:
            return False

        print(f"📋 Found {len(templates)} templates")

        # Test create template
        template_data = {
            "name": f"Test Template {datetime.now().strftime('%H%M%S')}",
            "fields": [
                {
                    "name": "invoice_number",
                    "field_type": "text",
                    "required": True,
                    "active": True,
                    "description": "Invoice number"
                },
                {
                    "name": "total_amount",
                    "field_type": "currency", 
                    "required": True,
                    "active": True,
                    "description": "Total amount"
                }
            ]
        }

        success, new_template = self.run_test(
            "Create Template",
            "POST",
            "templates",
            200,
            template_data
        )
        if not success:
            return False

        template_id = new_template.get('id')
        if template_id:
            self.created_resources.append(('template', template_id))
            print(f"✅ Created template with ID: {template_id}")

            # Test get single template
            success, template = self.run_test(
                "Get Template",
                "GET",
                f"templates/{template_id}",
                200
            )
            if not success:
                return False

            # Test update template
            update_data = {
                "name": "Updated Test Template",
                "fields": template_data["fields"]
            }
            success, updated_template = self.run_test(
                "Update Template",
                "PUT", 
                f"templates/{template_id}",
                200,
                update_data
            )
            if not success:
                return False

        return True

    def test_document_analysis(self):
        """Test document analysis with sample file"""
        # Create a simple test PDF content (actually just text with .pdf extension for testing)
        test_content = b"""Sample Invoice
        Invoice #: INV-2024-001
        Date: 2024-12-28
        Total Amount: $250.00
        Customer: Test Company"""

        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as tmp_file:
            tmp_file.write(test_content)
            tmp_file.flush()
            
            try:
                with open(tmp_file.name, 'rb') as f:
                    files = {'file': ('test_invoice.txt', f, 'text/plain')}
                    
                    success, response = self.run_test(
                        "Analyze Sample Document",
                        "POST",
                        "templates/analyze",
                        200,
                        files=files
                    )
                    
                    if success:
                        detected_fields = response.get('detected_fields', [])
                        print(f"🤖 AI detected {len(detected_fields)} fields")
                        for field in detected_fields[:3]:  # Show first 3 fields
                            print(f"   - {field.get('name', 'unknown')}: {field.get('field_type', 'text')}")
                    
                    return success
            finally:
                Path(tmp_file.name).unlink(missing_ok=True)

    def test_workflow_management(self):
        """Test workflow operations"""
        
        # Test list workflows
        success, workflows = self.run_test(
            "List Workflows",
            "GET", 
            "workflows",
            200
        )
        if not success:
            return False

        print(f"🔄 Found {len(workflows)} workflows")

        # Create workflow (need a configuration first)
        configs = self.get_configurations()
        if not configs:
            print("⚠️  No configurations available for workflow test")
            return True  # Skip workflow test if no configs

        workflow_data = {
            "configuration_id": configs[0]['id'],
            "run_mode": "extraction_only",
            "email_filters": {}
        }

        success, new_workflow = self.run_test(
            "Create Workflow",
            "POST",
            "workflows", 
            200,
            workflow_data
        )
        if not success:
            return False

        workflow_id = new_workflow.get('id')
        if workflow_id:
            self.created_resources.append(('workflow', workflow_id))
            print(f"✅ Created workflow with ID: {workflow_id}")

            # Test get workflow
            success, workflow = self.run_test(
                "Get Workflow",
                "GET",
                f"workflows/{workflow_id}",
                200
            )
            if not success:
                return False

            # Test start workflow
            success, start_response = self.run_test(
                "Start Workflow",
                "POST",
                f"workflows/{workflow_id}/start",
                200
            )

        return success

    def test_document_upload(self):
        """Test document upload functionality"""
        # Create a simple test file
        test_content = b"""Test Document Content
        Field1: Value1
        Field2: Value2"""

        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as tmp_file:
            tmp_file.write(test_content)
            tmp_file.flush()
            
            try:
                with open(tmp_file.name, 'rb') as f:
                    files = {'file': ('test_document.txt', f, 'text/plain')}
                    
                    success, response = self.run_test(
                        "Upload Document",
                        "POST",
                        "documents/upload",
                        200,
                        files=files
                    )
                    
                    if success:
                        doc_id = response.get('id')
                        if doc_id:
                            self.created_resources.append(('document', doc_id))
                            print(f"✅ Uploaded document with ID: {doc_id}")
                            
                            extracted_fields = response.get('extracted_fields', {})
                            print(f"📄 Extracted {len(extracted_fields)} fields")
                    
                    return success
            finally:
                Path(tmp_file.name).unlink(missing_ok=True)

    def test_export_functionality(self):
        """Test document export"""
        success, response = self.run_test(
            "Export Documents", 
            "GET",
            "export/documents?format=csv",
            200
        )
        if success:
            print("📤 Export functionality working")
        return success

    def test_email_connection(self):
        """Test email connection testing endpoint"""
        # Use the provided test config ID
        config_id = "e3376763-c35c-4e70-82d4-689ca1548ac9"
        
        success, response = self.run_test(
            "Test Email Connection",
            "POST",
            f"configurations/{config_id}/test-email",
            200
        )
        if success:
            print(f"📧 Email test result: {response.get('message', 'No message')}")
            if response.get('success'):
                print("✅ Email connection successful")
            else:
                print("⚠️ Email connection failed (expected if no credentials configured)")
        return success

    def test_matching_functionality(self):
        """Test document matching functionality"""
        # First get documents
        success, documents = self.run_test(
            "List Documents for Matching",
            "GET",
            "documents",
            200
        )
        if not success:
            return False
            
        if not documents:
            print("⚠️ No documents available for matching test")
            return True  # Skip matching test if no documents
            
        doc_id = documents[0].get('id')
        config_id = "e3376763-c35c-4e70-82d4-689ca1548ac9"
        
        if doc_id:
            success, response = self.run_test(
                "Test Document Matching",
                "POST",
                f"documents/{doc_id}/match?config_id={config_id}",
                200
            )
            if success:
                status = response.get('status', 'unknown')
                print(f"🔗 Matching result: {status}")
                if 'score' in response:
                    score = response['score'] * 100
                    print(f"📊 Matching score: {score:.1f}%")
            return success
        else:
            print("⚠️ No document ID available for matching test")
            return True

    def test_document_reextraction(self):
        """Test document re-extraction functionality"""
        # First get documents
        success, documents = self.run_test(
            "List Documents for Re-extraction",
            "GET", 
            "documents",
            200
        )
        if not success:
            return False
            
        if not documents:
            print("⚠️ No documents available for re-extraction test")
            return True
            
        doc_id = documents[0].get('id')
        
        if doc_id:
            success, response = self.run_test(
                "Test Document Re-extraction",
                "POST",
                f"documents/{doc_id}/reextract",
                200
            )
            if success:
                extracted_fields = response.get('extracted_fields', {})
                print(f"🔄 Re-extracted {len(extracted_fields)} fields")
            return success
        else:
            print("⚠️ No document ID available for re-extraction test")
            return True

    def test_matching_source_data(self):
        """Test matching source data upload and retrieval"""
        config_id = "e3376763-c35c-4e70-82d4-689ca1548ac9"
        
        # Test sample matching data with the invoice numbers mentioned in the context
        sample_data = [
            {
                "invoice_number": "1534FMBIL0001803",
                "vendor_name": "Test Vendor 1",
                "total_amount": 1250.00,
                "date": "2024-12-20"
            },
            {
                "invoice_number": "1534FMBIL0001422", 
                "vendor_name": "Test Vendor 2",
                "total_amount": 890.50,
                "date": "2024-12-21"
            }
        ]
        
        # Upload matching source data
        success, response = self.run_test(
            "Upload Matching Source Data",
            "POST",
            f"configurations/{config_id}/matching-source",
            200,
            {"data": sample_data}
        )
        if success:
            record_count = response.get('record_count', 0)
            print(f"📤 Uploaded {record_count} matching records")
        
        if not success:
            return False
            
        # Get matching source data
        success, response = self.run_test(
            "Get Matching Source Data",
            "GET",
            f"configurations/{config_id}/matching-source",
            200
        )
        if success:
            data_count = response.get('record_count', 0)
            print(f"📥 Retrieved {data_count} matching records")
            
        return success

    def get_configurations(self):
        """Helper to get existing configurations"""
        try:
            response = requests.get(f"{self.base_url}/configurations", timeout=10)
            if response.status_code == 200:
                return response.json()
        except:
            pass
        return []

    def cleanup_resources(self):
        """Clean up created test resources"""
        print("\n🧹 Cleaning up test resources...")
        
        for resource_type, resource_id in self.created_resources:
            try:
                if resource_type == 'configuration':
                    endpoint = f"configurations/{resource_id}"
                elif resource_type == 'template':
                    endpoint = f"templates/{resource_id}"
                elif resource_type == 'workflow':
                    endpoint = f"workflows/{resource_id}"
                elif resource_type == 'document':
                    endpoint = f"documents/{resource_id}"
                else:
                    continue
                
                url = f"{self.base_url}/{endpoint}"
                response = requests.delete(url, timeout=10)
                if response.status_code in [200, 204, 404]:
                    print(f"🗑️  Deleted {resource_type}: {resource_id}")
                else:
                    print(f"⚠️  Failed to delete {resource_type}: {resource_id}")
            except Exception as e:
                print(f"⚠️  Error deleting {resource_type} {resource_id}: {e}")

def main():
    """Main test runner"""
    print("🚀 Starting AI Document Extraction Platform API Tests")
    print("=" * 60)
    
    tester = DocumentExtractionAPITester()
    
    # List of test functions to run
    tests = [
        ("API Root", tester.test_root_endpoint),
        ("Dashboard Stats", tester.test_dashboard_stats), 
        ("Recent Runs", tester.test_recent_runs),
        ("Configurations CRUD", tester.test_configurations_crud),
        ("Templates CRUD", tester.test_templates_crud),
        ("Document Analysis", tester.test_document_analysis),
        ("Workflow Management", tester.test_workflow_management),
        ("Document Upload", tester.test_document_upload),
        ("Export Functionality", tester.test_export_functionality),
        ("Email Connection Test", tester.test_email_connection),
        ("Matching Source Data", tester.test_matching_source_data),
        ("Document Matching", tester.test_matching_functionality),
        ("Document Re-extraction", tester.test_document_reextraction),
    ]
    
    failed_tests = []
    
    try:
        for test_name, test_func in tests:
            print(f"\n{'='*20} {test_name} {'='*20}")
            try:
                success = test_func()
                if not success:
                    failed_tests.append(test_name)
            except Exception as e:
                print(f"❌ {test_name} failed with error: {e}")
                failed_tests.append(test_name)
    
    finally:
        # Always try to cleanup
        tester.cleanup_resources()
    
    # Print final results
    print(f"\n{'='*60}")
    print(f"📊 Test Results Summary")
    print(f"{'='*60}")
    print(f"✅ Tests Passed: {tester.tests_passed}")
    print(f"❌ Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"📈 Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed Test Categories:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print(f"\n🎉 All test categories passed!")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
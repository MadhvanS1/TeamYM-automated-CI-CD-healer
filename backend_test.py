import requests
import sys
import json
from datetime import datetime

class CICDHealingAgentTester:
    def __init__(self, base_url="https://auto-heal-ci.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, test_name, success, details="", response_data=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}")
        else:
            print(f"❌ {test_name} - {details}")
        
        self.test_results.append({
            "test_name": test_name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=True):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=15)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json()
                    self.log_test(name, True, f"Status: {response.status_code}", response_data)
                    return True, response_data
                except:
                    self.log_test(name, True, f"Status: {response.status_code}")
                    return True, {}
            else:
                try:
                    error_data = response.json()
                    self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}: {error_data}")
                except:
                    self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}")
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication Endpoints...")
        
        # Test root endpoint first
        self.run_test("API Root", "GET", "", 200, auth_required=False)
        
        # Test registration
        test_timestamp = datetime.now().strftime("%H%M%S")
        test_user = {
            "name": "TestUser",
            "email": f"test{test_timestamp}@example.com",
            "password": "Test1234"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST", 
            "auth/register",
            200,
            test_user,
            auth_required=False
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response.get('user', {}).get('id')
            print(f"📱 Token acquired: {self.token[:20]}...")
        
        # Test login with the same credentials
        login_data = {"email": test_user["email"], "password": test_user["password"]}
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login", 
            200,
            login_data,
            auth_required=False
        )
        
        if success and 'token' in response and not self.token:
            self.token = response['token']
            self.user_id = response.get('user', {}).get('id')
        
        # Test /auth/me endpoint
        if self.token:
            self.run_test("Get Current User", "GET", "auth/me", 200)
        else:
            self.log_test("Get Current User", False, "No token available")

    def test_dashboard_endpoints(self):
        """Test dashboard statistics endpoints"""
        print("\n📊 Testing Dashboard Endpoints...")
        
        if not self.token:
            self.log_test("Dashboard Stats", False, "No authentication token")
            return
            
        self.run_test("Dashboard Statistics", "GET", "dashboard/stats", 200)

    def test_simulation_endpoints(self):
        """Test simulation endpoints for seeding data"""
        print("\n🎲 Testing Simulation Endpoints...")
        
        if not self.token:
            self.log_test("Seed Data", False, "No authentication token")
            return
            
        # Seed demo data
        success, response = self.run_test("Seed Demo Data", "POST", "simulate/seed", 200, {})
        
        # Simulate a failure
        self.run_test("Simulate Failure", "POST", "simulate/failure", 200, {})

    def test_pipeline_endpoints(self):
        """Test pipeline run endpoints"""
        print("\n🔄 Testing Pipeline Endpoints...")
        
        if not self.token:
            self.log_test("Get Pipeline Runs", False, "No authentication token")
            return
        
        # Get all pipeline runs
        success, response = self.run_test("Get Pipeline Runs", "GET", "pipeline-runs", 200)
        
        # Test with limit parameter
        self.run_test("Get Pipeline Runs (Limited)", "GET", "pipeline-runs?limit=10", 200)
        
        # Test with status filter
        self.run_test("Get Failed Pipeline Runs", "GET", "pipeline-runs?status=failure", 200)
        
        # Test getting specific pipeline run
        if success and response and len(response) > 0:
            pipeline_id = response[0].get('id')
            if pipeline_id:
                self.run_test("Get Specific Pipeline Run", "GET", f"pipeline-runs/{pipeline_id}", 200)

    def test_healing_endpoints(self):
        """Test healing attempt endpoints"""
        print("\n🏥 Testing Healing Endpoints...")
        
        if not self.token:
            self.log_test("Get Healing Attempts", False, "No authentication token")
            return
        
        # Get healing attempts
        success, response = self.run_test("Get Healing Attempts", "GET", "healing-attempts", 200)
        
        # Test triggering healing on a failed pipeline
        # First, get failed pipeline runs
        pipeline_success, pipeline_response = self.run_test("Get Failed Pipelines for Healing", "GET", "pipeline-runs?status=failure", 200)
        
        if pipeline_success and pipeline_response and len(pipeline_response) > 0:
            failed_run_id = pipeline_response[0].get('id')
            if failed_run_id:
                # Trigger healing
                heal_data = {"pipeline_run_id": failed_run_id}
                heal_success, heal_response = self.run_test("Trigger Healing", "POST", "healing-attempts/trigger", 200, heal_data)
                
                if heal_success and heal_response:
                    attempt_id = heal_response.get('id')
                    if attempt_id:
                        # Get specific healing attempt
                        self.run_test("Get Specific Healing Attempt", "GET", f"healing-attempts/{attempt_id}", 200)

    def test_config_endpoints(self):
        """Test agent configuration endpoints"""
        print("\n⚙️ Testing Configuration Endpoints...")
        
        if not self.token:
            self.log_test("Get Agent Config", False, "No authentication token")
            return
        
        # Get current config
        success, response = self.run_test("Get Agent Config", "GET", "config", 200)
        
        # Update config
        config_update = {
            "ai_model": "gpt-4o",
            "max_heal_attempts": 3,
            "auto_merge": False,
            "notifications_enabled": True
        }
        self.run_test("Update Agent Config", "PUT", "config", 200, config_update)

    def test_analyze_failure_endpoint(self):
        """Test manual failure analysis endpoint"""
        print("\n🔍 Testing Analysis Endpoints...")
        
        if not self.token:
            self.log_test("Analyze Failure", False, "No authentication token")
            return
        
        # Get a failed pipeline first
        success, response = self.run_test("Get Pipeline for Analysis", "GET", "pipeline-runs?status=failure&limit=1", 200)
        
        if success and response and len(response) > 0:
            pipeline_id = response[0].get('id')
            if pipeline_id:
                analyze_data = {"pipeline_run_id": pipeline_id}
                self.run_test("Analyze Failure", "POST", "analyze-failure", 200, analyze_data)

    def test_auth_protection(self):
        """Test that protected endpoints require authentication"""
        print("\n🛡️ Testing Authentication Protection...")
        
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        # These should all fail with 403/401
        protected_endpoints = [
            ("GET", "dashboard/stats"),
            ("GET", "pipeline-runs"),
            ("GET", "healing-attempts"),
            ("GET", "config"),
            ("POST", "simulate/seed")
        ]
        
        for method, endpoint in protected_endpoints:
            expected_status = 403 if method == "GET" else 403  # Expecting 403 for unauthorized access
            # Note: The actual status might be 401, let's check both
            success1, _ = self.run_test(f"Protected {endpoint} (401)", method, endpoint, 401, auth_required=True)
            if not success1:
                success2, _ = self.run_test(f"Protected {endpoint} (403)", method, endpoint, 403, auth_required=True)
                if success1 or success2:
                    # Consider it passed if either 401 or 403
                    pass
        
        # Restore token
        self.token = original_token

    def run_all_tests(self):
        """Run the complete test suite"""
        print(f"🚀 Starting CI/CD Healing Agent API Tests")
        print(f"📡 Base URL: {self.base_url}")
        
        try:
            self.test_auth_endpoints()
            self.test_dashboard_endpoints()
            self.test_simulation_endpoints()
            self.test_pipeline_endpoints()
            self.test_healing_endpoints()
            self.test_config_endpoints()
            self.test_analyze_failure_endpoint()
            self.test_auth_protection()
            
        except Exception as e:
            print(f"❌ Test suite failed with error: {str(e)}")
        
        # Print summary
        print(f"\n📊 Test Results Summary")
        print(f"Total tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"Success rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = CICDHealingAgentTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "failed_tests": tester.tests_run - tester.tests_passed,
        "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
        "test_details": tester.test_results
    }
    
    try:
        with open("/app/test_reports/backend_api_results.json", "w") as f:
            json.dump(results, f, indent=2)
        print(f"📄 Detailed results saved to /app/test_reports/backend_api_results.json")
    except Exception as e:
        print(f"⚠️ Could not save results: {e}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
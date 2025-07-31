#!/usr/bin/env python3
"""
Backend API Testing Script for Twitter Engagement Bot
Tests all core backend endpoints to ensure functionality
"""

import requests
import json
import sys
import os
from datetime import datetime

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"Error reading frontend .env: {e}")
        return None

BACKEND_URL = get_backend_url()
if not BACKEND_URL:
    print("❌ Could not get backend URL from frontend/.env")
    sys.exit(1)

print(f"🔗 Testing backend at: {BACKEND_URL}")

class TwitterBotTester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   {details}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
        
    def test_health_check(self):
        """Test /api/health endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'status' in data and 'bot_running' in data:
                    self.log_test("Health Check", True, f"Status: {data['status']}, Bot Running: {data['bot_running']}")
                    return True
                else:
                    self.log_test("Health Check", False, "Missing required fields in response")
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Request failed: {str(e)}")
            return False
    
    def test_twitter_verification(self):
        """Test /api/twitter/verify endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/twitter/verify", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if 'status' in data and data['status'] == 'connected' and 'user' in data:
                    user_info = data['user']
                    self.log_test("Twitter Verification", True, 
                                f"Connected as @{user_info.get('username', 'unknown')} ({user_info.get('name', 'unknown')})")
                    return True
                else:
                    self.log_test("Twitter Verification", False, "Invalid response format")
                    return False
            else:
                self.log_test("Twitter Verification", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Twitter Verification", False, f"Request failed: {str(e)}")
            return False
    
    def test_target_accounts_get(self):
        """Test GET /api/target-accounts endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/target-accounts", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'accounts' in data and isinstance(data['accounts'], list):
                    account_count = len(data['accounts'])
                    self.log_test("Get Target Accounts", True, f"Retrieved {account_count} accounts")
                    return True, data['accounts']
                else:
                    self.log_test("Get Target Accounts", False, "Invalid response format")
                    return False, []
            else:
                self.log_test("Get Target Accounts", False, f"HTTP {response.status_code}: {response.text}")
                return False, []
                
        except Exception as e:
            self.log_test("Get Target Accounts", False, f"Request failed: {str(e)}")
            return False, []
    
    def test_comments_get(self):
        """Test GET /api/comments endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/comments", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'comments' in data and isinstance(data['comments'], list):
                    comment_count = len(data['comments'])
                    active_comments = len([c for c in data['comments'] if c.get('is_active', True)])
                    self.log_test("Get Comments", True, f"Retrieved {comment_count} comments ({active_comments} active)")
                    return True, data['comments']
                else:
                    self.log_test("Get Comments", False, "Invalid response format")
                    return False, []
            else:
                self.log_test("Get Comments", False, f"HTTP {response.status_code}: {response.text}")
                return False, []
                
        except Exception as e:
            self.log_test("Get Comments", False, f"Request failed: {str(e)}")
            return False, []
    
    def test_settings_get(self):
        """Test GET /api/settings endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/settings", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'settings' in data and isinstance(data['settings'], dict):
                    settings = data['settings']
                    required_fields = ['is_active', 'comments_per_day', 'min_delay_minutes', 'max_delay_minutes']
                    missing_fields = [field for field in required_fields if field not in settings]
                    
                    if not missing_fields:
                        self.log_test("Get Bot Settings", True, 
                                    f"Active: {settings['is_active']}, Comments/day: {settings['comments_per_day']}")
                        return True, settings
                    else:
                        self.log_test("Get Bot Settings", False, f"Missing fields: {missing_fields}")
                        return False, {}
                else:
                    self.log_test("Get Bot Settings", False, "Invalid response format")
                    return False, {}
            else:
                self.log_test("Get Bot Settings", False, f"HTTP {response.status_code}: {response.text}")
                return False, {}
                
        except Exception as e:
            self.log_test("Get Bot Settings", False, f"Request failed: {str(e)}")
            return False, {}
    
    def test_activity_logs_get(self):
        """Test GET /api/logs endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/logs?limit=10", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'logs' in data and isinstance(data['logs'], list):
                    log_count = len(data['logs'])
                    success_logs = len([log for log in data['logs'] if log.get('status') == 'success'])
                    failed_logs = len([log for log in data['logs'] if log.get('status') == 'failed'])
                    
                    self.log_test("Get Activity Logs", True, 
                                f"Retrieved {log_count} logs ({success_logs} success, {failed_logs} failed)")
                    return True, data['logs']
                else:
                    self.log_test("Get Activity Logs", False, "Invalid response format")
                    return False, []
            else:
                self.log_test("Get Activity Logs", False, f"HTTP {response.status_code}: {response.text}")
                return False, []
                
        except Exception as e:
            self.log_test("Get Activity Logs", False, f"Request failed: {str(e)}")
            return False, []
    
    def test_target_account_crud(self):
        """Test target account CRUD operations"""
        test_username = "jack"  # Using a real Twitter account for testing
        account_id = None
        
        try:
            # Test adding a target account
            add_payload = {
                "username": test_username,
                "is_active": False  # Keep inactive for testing
            }
            
            response = self.session.post(f"{self.base_url}/api/target-accounts", 
                                       json=add_payload, timeout=15)
            
            if response.status_code == 200:
                self.log_test("Add Target Account", True, f"Added @{test_username}")
                
                # Get the account to find its ID
                success, accounts = self.test_target_accounts_get()
                if success:
                    test_account = next((acc for acc in accounts if acc['username'] == test_username), None)
                    if test_account:
                        account_id = test_account['id']
                        
                        # Test toggle account
                        toggle_response = self.session.put(f"{self.base_url}/api/target-accounts/{account_id}/toggle", 
                                                         timeout=10)
                        if toggle_response.status_code == 200:
                            self.log_test("Toggle Target Account", True, "Account status toggled")
                        else:
                            self.log_test("Toggle Target Account", False, f"HTTP {toggle_response.status_code}")
                        
                        # Test delete account
                        delete_response = self.session.delete(f"{self.base_url}/api/target-accounts/{account_id}", 
                                                            timeout=10)
                        if delete_response.status_code == 200:
                            self.log_test("Delete Target Account", True, "Account deleted successfully")
                        else:
                            self.log_test("Delete Target Account", False, f"HTTP {delete_response.status_code}")
                    else:
                        self.log_test("Find Test Account", False, "Could not find added account")
                        
            elif response.status_code == 400 and "already exists" in response.text:
                self.log_test("Add Target Account", True, f"Account @{test_username} already exists (expected)")
                
                # Still try to find and test with existing account
                success, accounts = self.test_target_accounts_get()
                if success:
                    test_account = next((acc for acc in accounts if acc['username'] == test_username), None)
                    if test_account:
                        account_id = test_account['id']
                        
                        # Test toggle existing account
                        toggle_response = self.session.put(f"{self.base_url}/api/target-accounts/{account_id}/toggle", 
                                                         timeout=10)
                        if toggle_response.status_code == 200:
                            self.log_test("Toggle Existing Account", True, "Account status toggled")
                        else:
                            self.log_test("Toggle Existing Account", False, f"HTTP {toggle_response.status_code}")
            else:
                self.log_test("Add Target Account", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Target Account CRUD", False, f"Request failed: {str(e)}")
    
    def test_comment_crud(self):
        """Test comment CRUD operations"""
        test_comment_text = "Test comment for API validation 🚀"
        comment_id = None
        
        try:
            # Test adding a comment
            add_payload = {
                "text": test_comment_text,
                "category": "general",
                "is_active": True
            }
            
            response = self.session.post(f"{self.base_url}/api/comments", 
                                       json=add_payload, timeout=10)
            
            if response.status_code == 200:
                self.log_test("Add Comment", True, "Comment added successfully")
                
                # Get comments to find the test comment
                success, comments = self.test_comments_get()
                if success:
                    test_comment = next((c for c in comments if c['text'] == test_comment_text), None)
                    if test_comment:
                        comment_id = test_comment['id']
                        
                        # Test delete comment
                        delete_response = self.session.delete(f"{self.base_url}/api/comments/{comment_id}", 
                                                            timeout=10)
                        if delete_response.status_code == 200:
                            self.log_test("Delete Comment", True, "Comment deleted successfully")
                        else:
                            self.log_test("Delete Comment", False, f"HTTP {delete_response.status_code}")
                    else:
                        self.log_test("Find Test Comment", False, "Could not find added comment")
            else:
                self.log_test("Add Comment", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Comment CRUD", False, f"Request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print("🧪 Starting Twitter Engagement Bot Backend API Tests")
        print("=" * 60)
        
        # Core API tests
        self.test_health_check()
        self.test_twitter_verification()
        self.test_target_accounts_get()
        self.test_comments_get()
        self.test_settings_get()
        self.test_activity_logs_get()
        
        # CRUD operation tests
        print("\n🔄 Testing CRUD Operations")
        print("-" * 30)
        self.test_target_account_crud()
        self.test_comment_crud()
        
        # Summary
        print("\n📊 Test Summary")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ Failed Tests:")
            for test in self.test_results:
                if not test['success']:
                    print(f"  - {test['test']}: {test['details']}")
        
        return failed_tests == 0

def main():
    """Main test execution"""
    if not BACKEND_URL:
        print("❌ Backend URL not configured")
        return False
        
    tester = TwitterBotTester(BACKEND_URL)
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All backend API tests passed!")
        return True
    else:
        print("\n⚠️  Some backend API tests failed!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
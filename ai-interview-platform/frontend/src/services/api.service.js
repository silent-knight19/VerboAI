/*
================================================================================
API SERVICE
================================================================================
ROLE: Centralized HTTP client for all backend API calls.
WHY:  Every request to the backend must include the Firebase ID token.
      Instead of repeating this logic everywhere, we put it in ONE place.
HOW:  Before each request, we get the current ID token from Firebase
      and attach it to the Authorization header.
================================================================================

GOLDEN RULE:
  NEVER call fetch() directly to the backend.
  ALWAYS use ApiService (this file).
  This ensures authentication is consistent everywhere.
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  auth - Our Firebase auth instance
  
  ROLE: We use auth.currentUser.getIdToken() to get the current token
  WHY:  Firebase manages token refresh automatically; we just ask for it
*/
import { auth } from './firebase';


// =============================================================================
// CONFIGURATION
// =============================================================================

/*
  API_BASE_URL - The base URL for our backend
  
  ROLE: Where all API requests go
  WHY:  In development, backend runs on port 3000
        In production, it might be a different domain
  HOW:  We read from environment variable or use default
*/
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';


// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/*
  getIdToken() - Get the current user's ID token
  
  ROLE: Retrieve a fresh ID token from Firebase
  WHY:  ID tokens expire (~1 hour), Firebase refreshes them automatically
        We call getIdToken() which returns a fresh valid token
  HOW:  auth.currentUser.getIdToken() returns a Promise<string>
  
  RETURNS: The ID token string, or null if no user is logged in
*/
async function getIdToken() {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    console.log('⚠️ ApiService: No user logged in, cannot get token');
    return null;
  }
  
  try {
    // getIdToken(true) forces a refresh if needed
    // getIdToken() or getIdToken(false) uses cached token if still valid
    const token = await currentUser.getIdToken();
    return token;
  } catch (error) {
    console.error('❌ ApiService: Failed to get ID token:', error);
    return null;
  }
}

/*
  buildHeaders() - Create the headers object for requests
  
  ROLE: Attach the Authorization header with the ID token
  WHY:  Our backend middleware expects "Authorization: Bearer <token>"
  HOW:  We get the token and build the headers object
  
  RETURNS: Headers object with Authorization and Content-Type
*/
async function buildHeaders() {
  const token = await getIdToken();
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}


// =============================================================================
// API SERVICE OBJECT
// =============================================================================

/*
  ApiService - Object containing all API methods
  
  ROLE: Provides easy methods for GET, POST, PUT, DELETE requests
  WHY:  Abstracts away the token logic; components just call ApiService.get(...)
  
  USAGE:
    import { ApiService } from './services/api.service';
    
    // Get current user profile
    const result = await ApiService.get('/api/me');
    
    // Submit interview data
    const result = await ApiService.post('/api/interviews', { question: '...' });
*/
const ApiService = {
  
  /*
    get(endpoint) - Make a GET request
    
    ROLE: Fetch data from the backend
    PARAMS:
      - endpoint: The URL path (e.g., '/api/me', '/api/interviews')
    RETURNS: The JSON response data
    THROWS: Error if request fails
    
    EXAMPLE:
      const data = await ApiService.get('/api/me');
      console.log(data.user); // { uid, email, ... }
  */
  get: async function (endpoint) {
    console.log('🌐 ApiService GET:', endpoint);
    
    const headers = await buildHeaders();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: headers
    });
    
    // Check if response is OK (status 200-299)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ ApiService GET failed:', response.status, errorData);
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }
    
    return response.json();
  },
  
  /*
    post(endpoint, data) - Make a POST request
    
    ROLE: Send data to the backend (create resources)
    PARAMS:
      - endpoint: The URL path
      - data: Object to send in the request body
    RETURNS: The JSON response data
    
    EXAMPLE:
      const result = await ApiService.post('/api/interviews/start', {
        questionId: 123
      });
  */
  post: async function (endpoint, data = {}) {
    console.log('🌐 ApiService POST:', endpoint);
    
    const headers = await buildHeaders();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ ApiService POST failed:', response.status, errorData);
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }
    
    return response.json();
  },
  
  /*
    put(endpoint, data) - Make a PUT request
    
    ROLE: Update existing data on the backend
    PARAMS:
      - endpoint: The URL path
      - data: Object with updated data
    RETURNS: The JSON response data
  */
  put: async function (endpoint, data = {}) {
    console.log('🌐 ApiService PUT:', endpoint);
    
    const headers = await buildHeaders();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ ApiService PUT failed:', response.status, errorData);
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }
    
    return response.json();
  },
  
  /*
    delete(endpoint) - Make a DELETE request
    
    ROLE: Remove data from the backend
    PARAMS:
      - endpoint: The URL path
    RETURNS: The JSON response data
  */
  delete: async function (endpoint) {
    console.log('🌐 ApiService DELETE:', endpoint);
    
    const headers = await buildHeaders();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: headers
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ ApiService DELETE failed:', response.status, errorData);
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }
    
    return response.json();
  }
};


// =============================================================================
// EXPORT
// =============================================================================

/*
  Named export
  
  USAGE:
    import { ApiService } from './services/api.service';
*/
export { ApiService };

const fetch = require('node-fetch');
const NodeCache = require('node-cache');

const API_KEY = 'aaa96136-492f-4435-8177-714d8d64cf93';
const API_BASE_URL = 'https://drive.api.hscc.bdpa.org/v1';
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

class ApiService {
  constructor() {
    this.headers = {
      'Authorization': `bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    };
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...this.headers, ...options.headers }
      });

      if (response.status === 429) {
        const data = await response.json();
        throw new Error(`Rate limited. Retry after ${data.retryAfter}ms`);
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // User endpoints
  async getAllUsers(after = null) {
    const endpoint = `/users${after ? `?after=${after}` : ''}`;
    return this.makeRequest(endpoint);
  }

  async createUser(userData) {
    return this.makeRequest('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async getUser(username) {
    return this.makeRequest(`/users/${username}`);
  }

  async updateUser(username, updateData) {
    return this.makeRequest(`/users/${username}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  async deleteUser(username) {
    return this.makeRequest(`/users/${username}`, {
      method: 'DELETE'
    });
  }

  async authenticateUser(username, key) {
    return this.makeRequest(`/users/${username}/auth`, {
      method: 'POST',
      body: JSON.stringify({ key })
    });
  }

  // Filesystem endpoints
  async searchFiles(username, params = {}) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(JSON.stringify(value))}`)
      .join('&');
    
    const endpoint = `/filesystem/${username}/search${queryString ? `?${queryString}` : ''}`;
    return this.makeRequest(endpoint);
  }

  async createNode(username, nodeData) {
    return this.makeRequest(`/filesystem/${username}`, {
      method: 'POST',
      body: JSON.stringify(nodeData)
    });
  }

  async getNodes(username, nodeIds) {
    const idsPath = nodeIds.join('/');
    return this.makeRequest(`/filesystem/${username}/${idsPath}`);
  }

  async updateNode(username, nodeId, updateData) {
    return this.makeRequest(`/filesystem/${username}/${nodeId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  async deleteNodes(username, nodeIds) {
    const idsPath = nodeIds.join('/');
    return this.makeRequest(`/filesystem/${username}/${idsPath}`, {
      method: 'DELETE'
    });
  }
}

module.exports = new ApiService();

import React from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import App from './App';
import './index.css';

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL?.trim();
if (apiBaseUrl) {
  axios.defaults.baseURL = apiBaseUrl.replace(/\/$/, '');
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);

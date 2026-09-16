/* eslint-disable no-global-assign */

// index.js
import './config/serverManager.js';
import { validateWebConfiguration } from './config/deployment.js';
validateWebConfiguration();

// Validate configuration before modules initialize DB connections or listeners.
await import('./main.js');
await import('./sockets/monitoringSocket.js');

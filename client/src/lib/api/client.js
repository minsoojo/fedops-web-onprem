import axios from 'axios';
import { apiOrigin } from '../runtimeConfig';

const client = axios.create({ baseURL: apiOrigin, withCredentials: true });

export default client;
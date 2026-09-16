import { corsOrigins, webPort } from './config/deployment.js';
// main.js
import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import mongoose from 'mongoose';
import serve from 'koa-static';
import path from 'path';
import send from 'koa-send';
import http from 'http';
import { Server } from 'socket.io';
import jwtMiddleware from './lib/jwtMiddleware.js';
import apiLogger from './lib/apiLogger.js';
import { authenticateSocket } from './lib/socketAuth.js';

// Import your API routes
import api from './api/index.js';

// Import socket modules
import taskSockets from './sockets/taskSockets.js';
import monitoringSockets from './sockets/monitoringSocket.js';

// Import login count
import Count from './models/login_count.js';
import cron from 'node-cron';

// 비구조화 할당을 통해 process.env 내부 값에 대한 레퍼런스 만들기
const { MONGO_URI } = process.env;

// async function connectDB() {
//   try {
//     await mongoose.connect(MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//       useCreateIndex: true,
//       useFindAndModify: false
//     });
//     console.log('Connected to MongoDB');
//   } catch (error) {
//     console.error('Failed to connect to MongoDB: ', error);
//   }
// }

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true })
  .then(() => {
    console.log('Connected to MongoDB');
    // createFakeData();
  })
  .catch((e) => {
    console.error(e);
  });

const app = new Koa();
// app.proxy = true; // 신뢰할 수 있는 프록시 헤더 활성화

const router = new Router();

// 라우터 설정
router.use('/fedops/api', api.routes()); // api 라우트 적용

const allowedOrigins = corsOrigins();

// CORS 설정
app.use(cors({
  origin: ctx => allowedOrigins.includes(ctx.get('Origin')) ? ctx.get('Origin') : '',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control']
}));

// 라우터 적용 전에 bodyParser 적용
app.use(bodyParser());
app.use(apiLogger); // API 로깅 미들웨어 추가
app.use(jwtMiddleware);

// app 인스턴스에 라우터 적용
app.use(router.routes()).use(router.allowedMethods());



// const sslOptions = {
//   key: fs.readFileSync('/etc/ssl/private/ssl-key'),
//   cert: fs.readFileSync('/etc/ssl/private/ssl-cert')
// };

// Create an HTTP server and attach the Koa app to it
const server = http.createServer(app.callback());

// Initialize Socket.IO server
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'], // Allowed methods
    allowedHeaders: ['my-custom-header'], // Allowed headers
    credentials: true,
  },
});

io.use(authenticateSocket);
taskSockets(io); // Pass the Socket.IO server to the taskSockets module
monitoringSockets(io); // Pass the Socket.IO server to the monitoringSockets module

export default server;

// PORT가 지정되어 있지 않다면 4000을 사용
const port = webPort();

// Use the HTTP server to listen instead of the Koa app
server.listen(port, () => {
  console.log('Listening to port %d', port);
});

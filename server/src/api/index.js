import Router from 'koa-router';
import auth from './auth/index.js';
import tasks from './tasks/index.js';
import model from './model/index.js';
import count from './count/index.js';
import blog from './blog/index.js';
import news from './news/index.js';
import serverControl from './serverControl/index.js';
import realtime from './realtime/index.js';
import baselines from './baselines/index.js';
import taskReleases from './taskReleases/index.js';

const api = new Router();

api.get('/health', (ctx) => {
  ctx.status = 200;
  ctx.body = {
    status: 'ok',
    service: 'fedops-web-backend',
  };
});
api.use('/tasks', tasks.routes());
api.use('/auth', auth.routes());
api.use('/model', model.routes());
api.use('/count', count.routes());
api.use('/blog', blog.routes());
api.use('/news', news.routes());
api.use('/server-control', serverControl.routes());
api.use('/realtime', realtime.routes());
api.use('/baselines', baselines.routes());
api.use('/task-releases', taskReleases.routes());

// Export the router
export default api;

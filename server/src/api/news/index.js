import Router from 'koa-router';
import * as NewsCtrl from './news.ctrl.js';

const news = new Router();

news.post('/posts', NewsCtrl.post);
news.get('/list', NewsCtrl.list);
news.delete('/posts/:id', NewsCtrl.remove);
news.put('/posts/:id', NewsCtrl.update);
news.get('/posts/:id', NewsCtrl.read);

export default news;

import Router from 'koa-router';
import * as blogCtrl from './blog.ctrl.js';

const blog = new Router();

blog.post('/posts', blogCtrl.post);
blog.get('/list', blogCtrl.list);
blog.delete('/posts/:id', blogCtrl.remove);
blog.put('/posts/:id', blogCtrl.update);
blog.get('/posts/:id', blogCtrl.read);

export default blog;

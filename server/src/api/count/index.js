import Router from 'koa-router';
import * as countCtrl from './count.ctrl.js';

const count = new Router();

count.get('/today_count', countCtrl.count);

export default count;
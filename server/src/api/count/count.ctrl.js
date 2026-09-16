import Count from '../../models/login_count.js';
import mongoose from 'mongoose';

const { ObjectId } = mongoose.Types;

/*
  POST /api/count/today_count
*/

export const count = async(ctx) => {
    try{
        const today = new Date().toLocaleDateString();
        const todayCount = await Count.countDocuments({ date: today });
        const totalCount = await Count.countDocuments({});
        let loginCount = [
            {todayCount: todayCount},
            {totalCount: totalCount},
        ];
        ctx.body = loginCount;
    }  catch (e) {
        ctx.throw('count error', e);
    }
};
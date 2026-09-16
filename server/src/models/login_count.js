import mongoose, { Schema } from "mongoose";

const CountSchema = new Schema({
    date: String,
    username: String,
    login_time: String,
});

const Count = mongoose.model('Count', CountSchema, 'login.count');
export default Count;
import mongoose, { Schema } from 'mongoose';


  const BlogSchema = new Schema({
    title: { type: String, required: true }, // 제목 추가
    content: { type: String, required: true },
    image: { type: String, required: false }, // 이미지 URL 추가
  });
  

const Blog = mongoose.model("Blog", BlogSchema, 'fl.blog');
export default Blog;
  